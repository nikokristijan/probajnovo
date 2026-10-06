import "server-only";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, messages, type MessageStatus } from "@/lib/recenzije/db/schema";
import { fullName } from "@/lib/recenzije/utils";
import { logActivity } from "./activity";
import { cancelActiveRunsForClient } from "./automation-engine";

const STOP = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|odjava|odjavi|stani)\s*[.!]?\s*$/i;
const START = /^\s*(start|unstop|prijava)\s*$/i;

/** Status isporuke s bilo kojeg pružatelja. Konačna stanja se nikad ne vraćaju unatrag. */
export async function applyDeliveryStatus(providerSid: string, status: Exclude<MessageStatus, "QUEUED" | "RECEIVED">, error?: string) {
  const failed = status === "FAILED" || status === "UNDELIVERED";
  const [msg] = await db
    .update(messages)
    .set({
      status,
      ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      ...(failed ? { errorMessage: error || "Poruka nije isporučena" } : {}),
    })
    .where(
      and(
        eq(messages.providerSid, providerSid),
        notInArray(messages.status, status === "SENT" ? ["DELIVERED", "FAILED", "UNDELIVERED"] : ["DELIVERED"])
      )
    )
    .returning();
  if (msg && failed && msg.clientId) {
    const [c] = await db.select().from(clients).where(eq(clients.id, msg.clientId)).limit(1);
    await logActivity({
      organizationId: msg.organizationId,
      clientId: msg.clientId,
      type: "message_failed",
      title: `Poruka za ${c ? fullName(c) : msg.toNumber} nije poslana`,
      meta: { messageId: msg.id, error: msg.errorMessage },
    });
  }
  return msg ?? null;
}

/**
 * Dolazni SMS. Ako webhook zna tvrtku (SMS Gateway), koristi nju; inače (Twilio,
 * zajednički broj) tvrtku koja je tom broju zadnja pisala.
 */
export async function handleInboundSms(input: { organizationId?: string; from: string; to: string; body: string; providerSid?: string | null }) {
  const body = input.body.slice(0, 1600);
  let organizationId = input.organizationId;
  let clientId: string | null = null;

  if (organizationId) {
    const [c] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.organizationId, organizationId), eq(clients.phone, input.from)))
      .limit(1);
    clientId = c?.id ?? null;
  } else {
    const [last] = await db
      .select({ organizationId: messages.organizationId, clientId: messages.clientId })
      .from(messages)
      .where(and(eq(messages.toNumber, input.from), eq(messages.direction, "OUTBOUND")))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (!last) return;
    organizationId = last.organizationId;
    clientId = last.clientId;
  }

  const [client] = clientId
    ? await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId))).limit(1)
    : [];

  await db
    .insert(messages)
    .values({
      organizationId,
      clientId: client?.id ?? null,
      direction: "INBOUND",
      kind: "REPLY",
      toNumber: input.to || "",
      fromNumber: input.from,
      body,
      status: "RECEIVED",
      providerSid: input.providerSid || null,
    })
    .onConflictDoNothing();

  if (!client) return;
  const name = fullName(client);
  if (STOP.test(body)) {
    await db.update(clients).set({ smsOptOut: true, nextFollowUpAt: null }).where(eq(clients.id, client.id));
    await cancelActiveRunsForClient(organizationId, client.id, "Klijent je odgovorio STOP");
    await logActivity({ organizationId, clientId: client.id, type: "opt_out", title: `${name} se odjavio/la od SMS-ova` });
  } else if (START.test(body) && client.smsOptOut) {
    await db.update(clients).set({ smsOptOut: false }).where(eq(clients.id, client.id));
    await logActivity({ organizationId, clientId: client.id, type: "reply_received", title: `${name} se ponovno prijavio/la na SMS-ove` });
  } else {
    await logActivity({
      organizationId,
      clientId: client.id,
      type: "reply_received",
      title: `${name} je odgovorio/la: „${body.slice(0, 80)}${body.length > 80 ? "…" : ""}”`,
    });
  }
}
