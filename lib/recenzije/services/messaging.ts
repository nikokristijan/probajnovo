import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, messages, organizations, services, type MessageKind } from "@/lib/recenzije/db/schema";
import { env } from "@/lib/recenzije/env";
import { renderTemplate, withBusinessName } from "@/lib/recenzije/messages";
import { composeSms } from "@/lib/recenzije/sms-format";
import { isPublicHttpsUrl, publicHttpsProblem } from "@/lib/recenzije/twilio";
import { fullName } from "@/lib/recenzije/utils";
import { logActivity } from "./activity";
import { isNumberOptedOut } from "./opted-out";
import { sendSms, smsProvider, SmsNotConfiguredError } from "./sms";
import { createTrackingLink, getOrCreateClientToken } from "./tracking";
import { usage } from "./billing";

export { withBusinessName };

/** Adresa na koju Twilio javlja status isporuke; samo javna https (inače ju Twilio odbija ili ne može dosegnuti). */
export function twilioStatusCallbackUrl() {
  return isPublicHttpsUrl(env.appUrl) ? `${env.appUrl}/api/recenzije/webhooks/twilio/status` : undefined;
}

export type SendOutcome =
  | { ok: true; messageId: string; body: string }
  | { ok: false; messageId?: string; error: string; code: "NOT_CONFIGURED" | "NO_REVIEW_URL" | "OPTED_OUT" | "SEND_FAILED" | "NOT_FOUND" | "DEMO" | "LIMIT" };

export const DEMO_ERROR = "Ovo je demo za razgledavanje, pa se pravi SMS ne šalje.";

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
 * template contains {review_link}. Never pretends success: if no SMS provider is
 * configured (NOVO phone, see sms.ts) or the send fails, the message is stored as
 * FAILED with the reason.
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
    return {
      ok: false,
      error: "Pretplata ovog klijenta nije aktivna (razdoblje je isteklo ili paket nije aktiviran). Aktivirajte paket ili besplatno razdoblje u NOVO adminu.",
      code: "LIMIT",
    };
  }
  if (plan.smsUsed >= plan.smsLimit) {
    return {
      ok: false,
      error: `Dosegnut je mjesečni limit SMS-ova (${plan.smsLimit}). Za nastavak promijenite paket klijenta u NOVO adminu.`,
      code: "LIMIT",
    };
  }

  if (client.smsOptOut) {
    return { ok: false, error: `${fullName(client)} se odjavio/la od SMS-ova.`, code: "OPTED_OUT" };
  }

  // Pružatelj se odlučuje ovdje, jedanput, pa isti odgovor određuje i tekst (poveznica za odjavu samo uz
  // Twilio) i način slanja. Twilio u Hrvatskoj ne podržava odgovore, pa odjava ide poveznicom /o/<token>.
  const provider = smsProvider(org);
  // Poruka bez radne poveznice za odjavu ne smije otići: uz javnu https adresu stranice /o/<token> ne bi bila dostupna.
  const addressProblem = provider === "twilio" ? publicHttpsProblem(env.appUrl) : null;
  if (addressProblem) {
    return {
      ok: false,
      error: `Poveznica za odjavu u poruci ne bi radila (${addressProblem}). Administrator treba postaviti NR_APP_URL na javnu https adresu stranice.`,
      code: "NOT_CONFIGURED",
    };
  }

  let reviewToken: string | null = null;
  let trackingLinkId: string | null = null;
  if (input.template.includes("{review_link}")) {
    if (!org.googleReviewUrl) {
      return {
        ok: false,
        error: "Prije slanja dodajte link za Google recenzije u Postavke → Podaci tvrtke.",
        code: "NO_REVIEW_URL",
      };
    }
    const { link } = await createTrackingLink(org.id, client.id, org.googleReviewUrl);
    reviewToken = link.token;
    trackingLinkId = link.id;
  }
  // Isti token kao u /r/<token> poveznici klijenta (nema promjene sheme).
  const optOutToken =
    provider === "twilio" ? (reviewToken ?? (await getOrCreateClientToken(org.id, client.id, org.googleReviewUrl))) : null;

  const composed = composeSms({
    provider,
    optOutToken,
    appUrl: env.appUrl,
    shortUrl: env.shortUrl || null,
    render: (base) =>
      withBusinessName(
        renderTemplate(input.template, {
          firstName: client.firstName,
          lastName: client.lastName,
          businessName: org.name,
          service: service?.name,
          technician: service?.technician,
          serviceDate: service?.serviceDate,
          reviewLink: reviewToken ? `${base}/r/${reviewToken}` : null,
        }),
        org.name
      ),
  });
  const body = composed.body;

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
      statusCallback: twilioStatusCallbackUrl(),
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
  // Probna poruka nema klijenta ni poveznicu za odjavu, pa se nikad ne šalje na broj koji se već odjavio.
  if (await isNumberOptedOut(to)) {
    return { ok: false, error: "Taj se broj odjavio od SMS-ova, pa mu se ni probne poruke ne šalju.", code: "OPTED_OUT" };
  }
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
