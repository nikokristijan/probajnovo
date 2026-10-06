import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, messages, organizations, services, type MessageKind } from "@/lib/recenzije/db/schema";
import { env } from "@/lib/recenzije/env";
import { renderTemplate } from "@/lib/recenzije/messages";
import { fullName } from "@/lib/recenzije/utils";
import { logActivity } from "./activity";
import { sendSms, SmsNotConfiguredError } from "./sms";
import { createTrackingLink } from "./tracking";
import { usage } from "./billing";

export type SendOutcome =
  | { ok: true; messageId: string; body: string }
  | { ok: false; messageId?: string; error: string; code: "NOT_CONFIGURED" | "NO_REVIEW_URL" | "OPTED_OUT" | "SEND_FAILED" | "NOT_FOUND" | "DEMO" | "LIMIT" };

export const DEMO_ERROR =
  "Ovo je demo, pa se pravi SMS ne šalje. Napravite svoj račun za slanje poruka.";

/** Builds the template context for a client: latest service + business name. */
export async function messageContext(organizationId: string, clientId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);
  if (!client) return null;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.clientId, clientId), eq(services.organizationId, organizationId)))
    .orderBy(desc(services.serviceDate))
    .limit(1);
  return { client, org, service: service ?? null };
}

/**
 * Sends one SMS to a client of an organization. Creates a tracking link when the
 * template contains {review_link}. Never pretends success: if Twilio is not
 * configured or the send fails, the message is stored as FAILED with the reason.
 */
export async function sendClientMessage(input: {
  organizationId: string;
  clientId: string;
  template: string;
  kind: MessageKind;
  campaignId?: string | null;
  automationRunId?: string | null;
}): Promise<SendOutcome> {
  const ctx = await messageContext(input.organizationId, input.clientId);
  if (!ctx) return { ok: false, error: "Klijent nije pronađen", code: "NOT_FOUND" };
  const { client, org, service } = ctx;

  if (org.isDemo) {
    return { ok: false, error: DEMO_ERROR, code: "DEMO" };
  }

  const plan = await usage(org.id);
  if (!plan.active) {
    return { ok: false, error: "Probno razdoblje ili pretplata je istekla. Odaberite paket u Postavke → Pretplata.", code: "LIMIT" };
  }
  if (plan.smsUsed >= plan.smsLimit) {
    return { ok: false, error: `Dosegnut je mjesečni limit SMS-ova (${plan.smsLimit}). Za nastavak odaberite veći paket.`, code: "LIMIT" };
  }

  if (client.smsOptOut) {
    return { ok: false, error: `${fullName(client)} se odjavio/la od SMS-ova (odgovor STOP).`, code: "OPTED_OUT" };
  }

  let reviewLink: string | null = null;
  let trackingLinkId: string | null = null;
  if (input.template.includes("{review_link}")) {
    if (!org.googleReviewUrl) {
      return {
        ok: false,
        error: "Prije slanja dodajte link za Google recenzije u Postavke → Profil tvrtke.",
        code: "NO_REVIEW_URL",
      };
    }
    const { link, url } = await createTrackingLink(org.id, client.id, org.googleReviewUrl);
    reviewLink = url;
    trackingLinkId = link.id;
  }

  const body = renderTemplate(input.template, {
    firstName: client.firstName,
    lastName: client.lastName,
    businessName: org.name,
    service: service?.name,
    technician: service?.technician,
    serviceDate: service?.serviceDate,
    reviewLink,
  });

  const [msg] = await db
    .insert(messages)
    .values({
      organizationId: org.id,
      clientId: client.id,
      kind: input.kind,
      toNumber: client.phone,
      body,
      status: "QUEUED",
      campaignId: input.campaignId ?? null,
      automationRunId: input.automationRunId ?? null,
      trackingLinkId,
    })
    .returning();

  try {
    const res = await sendSms(org, {
      to: client.phone,
      body,
      statusCallback: env.appUrl.startsWith("https://") ? `${env.appUrl}/api/recenzije/webhooks/twilio/status` : undefined,
    });
    const now = new Date();
    await db
      .update(messages)
      .set({ providerSid: res.sid, fromNumber: res.from, status: "SENT", sentAt: now })
      .where(eq(messages.id, msg.id));

    const isRequest = input.kind === "REVIEW_REQUEST" || input.kind === "CAMPAIGN" || input.kind === "FOLLOW_UP";
    const nextStatus =
      isRequest && ["NOT_CONTACTED", "FOLLOW_UP_SCHEDULED"].includes(client.reviewStatus)
        ? "REQUEST_SENT"
        : client.reviewStatus;
    await db
      .update(clients)
      .set({ lastMessageAt: now, reviewStatus: nextStatus, nextFollowUpAt: null })
      .where(eq(clients.id, client.id));

    await logActivity({
      organizationId: org.id,
      clientId: client.id,
      type: input.kind === "FOLLOW_UP" ? "follow_up_sent" : "request_sent",
      title:
        input.kind === "FOLLOW_UP"
          ? `Podsjetnik poslan: ${fullName(client)}`
          : input.kind === "REVIEW_REQUEST" || input.kind === "CAMPAIGN"
            ? `Zahtjev za recenziju poslan: ${fullName(client)}`
            : `Poruka poslana: ${fullName(client)}`,
      meta: { messageId: msg.id },
    });
    return { ok: true, messageId: msg.id, body };
  } catch (e) {
    const notConfigured = e instanceof SmsNotConfiguredError;
    const error = e instanceof Error ? e.message : "Poruka nije poslana";
    await db.update(messages).set({ status: "FAILED", errorMessage: error }).where(eq(messages.id, msg.id));
    await logActivity({
      organizationId: org.id,
      clientId: client.id,
      type: "message_failed",
      title: `Poruka za ${fullName(client)} nije poslana`,
      meta: { messageId: msg.id, error },
    });
    return { ok: false, messageId: msg.id, error, code: notConfigured ? "NOT_CONFIGURED" : "SEND_FAILED" };
  }
}

/** Test message to an arbitrary number (the owner's phone). Not tied to a client. */
export async function sendTestMessage(organizationId: string, to: string, body: string): Promise<SendOutcome> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return { ok: false, error: "Tvrtka nije pronađena", code: "NOT_FOUND" };
  if (org.isDemo) return { ok: false, error: DEMO_ERROR, code: "DEMO" };
  const [msg] = await db
    .insert(messages)
    .values({ organizationId, kind: "TEST", toNumber: to, body, status: "QUEUED" })
    .returning();
  try {
    const res = await sendSms(org, { to, body });
    await db
      .update(messages)
      .set({ providerSid: res.sid, fromNumber: res.from, status: "SENT", sentAt: new Date() })
      .where(eq(messages.id, msg.id));
    return { ok: true, messageId: msg.id, body };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Poruka nije poslana";
    await db.update(messages).set({ status: "FAILED", errorMessage: error }).where(eq(messages.id, msg.id));
    return { ok: false, messageId: msg.id, error, code: e instanceof SmsNotConfiguredError ? "NOT_CONFIGURED" : "SEND_FAILED" };
  }
}
