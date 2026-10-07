import "server-only";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, messages, organizations, type Client, type MessageStatus } from "@/lib/recenzije/db/schema";
import { toE164 } from "@/lib/recenzije/phone";
import { fullName } from "@/lib/recenzije/utils";
import { logActivity } from "./activity";
import { cancelActiveRunsForClient } from "./automation-engine";
import { NOVO_SENDER } from "./sms";

const STOP = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|odjava|odjavi|stani|prestani|prestanite)\s*[.!]?\s*$/i;
const START = /^\s*(start|unstop|prijava)\s*$/i;
const MAX_REPLY_LENGTH = 1600;

export const isStopKeyword = (text: string) => STOP.test(text);
export const isStartKeyword = (text: string) => START.test(text);

/**
 * Status isporuke s bilo kojeg pružatelja. Konačna stanja se nikad ne vraćaju unatrag. Webhook koji zna
 * tvrtku (mobitel tvrtke) predaje organizationId, pa ne može dirati poruke tuđe tvrtke.
 */
export async function applyDeliveryStatus(
  providerSid: string,
  status: Exclude<MessageStatus, "QUEUED" | "RECEIVED">,
  error?: string,
  organizationId?: string
) {
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
        organizationId ? eq(messages.organizationId, organizationId) : undefined,
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
 * Sprema dolaznu poruku. Vraća false kad je poruka s istim providerSid već spremljena, tj. kad je
 * pružatelj ponovio isporuku webhooka (SMS Gateway ponavlja dok ne dobije 2xx).
 */
async function storeInbound(
  organizationId: string,
  clientId: string | null,
  input: { from: string; to: string; providerSid?: string | null },
  body: string
) {
  const rows = await db
    .insert(messages)
    .values({
      organizationId,
      clientId,
      direction: "INBOUND",
      kind: "REPLY",
      toNumber: input.to || "",
      fromNumber: input.from,
      body,
      status: "RECEIVED",
      providerSid: input.providerSid || null,
    })
    .onConflictDoNothing()
    .returning({ id: messages.id });
  return rows.length > 0;
}

/**
 * STOP: klijent se više ne kontaktira. Aktivnost se zapisuje samo kad se stanje stvarno promijeni, pa je
 * ponovljena obrada istog odgovora bezopasna (isto stanje, bez udvostručenih zapisa).
 */
async function optOutClient(client: Client) {
  // Stanje se mijenja atomski: samo zahtjev koji ga stvarno promijeni zapisuje aktivnost, pa dvije
  // istodobne isporuke istog odgovora ne udvostručuju zapis (klijent iz upita može biti zastario).
  const changed = await db
    .update(clients)
    .set({ smsOptOut: true, nextFollowUpAt: null })
    .where(and(eq(clients.id, client.id), eq(clients.smsOptOut, false)))
    .returning({ id: clients.id });
  if (changed.length > 0) {
    await logActivity({
      organizationId: client.organizationId,
      clientId: client.id,
      type: "opt_out",
      title: `${fullName(client)} se odjavio/la od SMS-ova`,
    });
  } else {
    await db.update(clients).set({ nextFollowUpAt: null }).where(eq(clients.id, client.id));
  }
  await cancelActiveRunsForClient(client.organizationId, client.id, "Klijent je odgovorio STOP");
}

async function resubscribeClient(client: Client) {
  await db.update(clients).set({ smsOptOut: false }).where(eq(clients.id, client.id));
  await logActivity({
    organizationId: client.organizationId,
    clientId: client.id,
    type: "reply_received",
    title: `${fullName(client)} se ponovno prijavio/la na SMS-ove`,
  });
}

async function logReply(client: Client, body: string) {
  await logActivity({
    organizationId: client.organizationId,
    clientId: client.id,
    type: "reply_received",
    title: `${fullName(client)} je odgovorio/la: „${body.slice(0, 80)}${body.length > 80 ? "…" : ""}”`,
  });
}

/**
 * Dolazni SMS. Ako webhook zna tvrtku (SMS Gateway tvrtke), koristi nju; inače (Twilio,
 * zajednički broj) tvrtku koja je tom broju zadnja pisala. Zajednički NOVO mobitel ima vlastiti
 * ulaz: handleSharedPhoneInbound.
 */
export async function handleInboundSms(input: { organizationId?: string; from: string; to: string; body: string; providerSid?: string | null }) {
  const body = input.body.slice(0, MAX_REPLY_LENGTH);
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

  const fresh = await storeInbound(organizationId, client?.id ?? null, input, body);

  if (!client) return;
  if (STOP.test(body)) {
    await optOutClient(client);
  } else if (START.test(body) && client.smsOptOut) {
    await resubscribeClient(client);
  } else if (fresh) {
    await logReply(client, body);
  }
}

/**
 * Moguće E.164 inačice broja koji je mobitel prijavio kao pošiljatelja. Gateway obično šalje "+385...",
 * ali ponekad dođe nacionalni oblik ("091...") ili međunarodni bez plusa ("38591...").
 */
export function gatewayPhoneCandidates(raw: string): string[] {
  const out: string[] = [];
  const primary = toE164(raw, "385");
  if (primary) out.push(primary);
  const text = raw.trim();
  const digits = text.replace(/\D/g, "");
  if (!text.startsWith("+") && !text.startsWith("0") && /^\d{11,15}$/.test(digits) && !out.includes(`+${digits}`)) {
    out.push(`+${digits}`);
  }
  return out;
}

/**
 * Dolazni SMS na ZAJEDNIČKI NOVO mobitel. Svi klijenti svih tvrtki primaju poruke s istog broja, pa:
 *
 * - tvrtka kojoj odgovor pripada je ona s najnovijom izlaznom porukom s NOVO mobitela na taj broj
 *   (messages.from_number = NOVO_SENDER); odgovor se sprema njoj;
 * - STOP odjavljuje broj u SVIM tvrtkama koje imaju klijenta s tim brojem (osim demoa), jer je
 *   osoba odgovorila broju s kojeg su stigle poruke svih njih. START vraća samo klijenta tvrtke
 *   kojoj je odgovor pripisan (ručnu odjavu u drugoj tvrtki ne diramo);
 * - ponovljena isporuka istog webhooka (isti providerSid) ne udvostručuje poruku ni aktivnost.
 */
export async function handleSharedPhoneInbound(input: {
  from: string | string[];
  to?: string;
  body: string;
  providerSid?: string | null;
}) {
  const result = { recorded: false, optedOut: 0 };
  const numbers = [...new Set((Array.isArray(input.from) ? input.from : [input.from]).filter(Boolean))];
  if (numbers.length === 0) return result;
  const body = input.body.slice(0, MAX_REPLY_LENGTH);
  const stop = STOP.test(body);

  const [last] = await db
    .select({ organizationId: messages.organizationId, toNumber: messages.toNumber })
    .from(messages)
    .where(and(inArray(messages.toNumber, numbers), eq(messages.direction, "OUTBOUND"), eq(messages.fromNumber, NOVO_SENDER)))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  // Nepoznat pošiljatelj koji nije tražio odjavu: ništa se ne sprema.
  if (!last && !stop) return result;

  const holders = await db
    .select({ client: clients })
    .from(clients)
    .innerJoin(organizations, eq(organizations.id, clients.organizationId))
    .where(and(inArray(clients.phone, numbers), eq(organizations.isDemo, false)));

  let fresh = true;
  let primary: Client | null = null;
  if (last) {
    primary = holders.find((h) => h.client.organizationId === last.organizationId && h.client.phone === last.toNumber)?.client ?? null;
    fresh = await storeInbound(
      last.organizationId,
      primary?.id ?? null,
      { from: last.toNumber, to: input.to ?? "", providerSid: input.providerSid },
      body
    );
    result.recorded = true;
  }

  if (stop) {
    // Primjenjuje se i na ponovljenu isporuku: ako je prvi pokušaj stao usred petlje, drugi ga dovršava.
    for (const { client } of holders) {
      await optOutClient(client);
      result.optedOut++;
    }
  } else if (primary) {
    if (START.test(body) && primary.smsOptOut) await resubscribeClient(primary);
    else if (fresh) await logReply(primary, body);
  }
  return result;
}
