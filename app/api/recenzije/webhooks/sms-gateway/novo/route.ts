import { createHash } from "crypto";
import { z } from "zod";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { env } from "@/lib/recenzije/env";
import { applyDeliveryStatus, gatewayPhoneCandidates, handleSharedPhoneInbound } from "@/lib/recenzije/services/inbound";
import { verifyGatewaySignature } from "@/lib/recenzije/services/sms";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Webhook aplikacije SMS Gateway for Android za ZAJEDNIČKI NOVO mobitel (svi klijenti, jedan broj).
 * Za razliku od webhooka po tvrtki ([orgId]) ovdje se tvrtka ne zna iz adrese: potvrde isporuke se
 * uparuju po ID-u poruke (jedinstven kroz sve tvrtke), a odgovori po zadnjoj poruci poslanoj na taj broj.
 *
 * Potpis: X-Signature = hex(HMAC-SHA256(SMS_GATEWAY_SIGNING_KEY, tijelo + X-Timestamp)). Nepotpisan ili
 * krivo potpisan zahtjev se odbija prije bilo kakvog pristupa bazi.
 */
const eventSchema = z.object({
  id: z.string().nullish(),
  event: z.string(),
  payload: z
    .object({
      messageId: z.string().nullish(),
      message: z.string().nullish(),
      // Pošiljatelj kod sms:received, primatelj kod sms:sent / delivered / failed.
      phoneNumber: z.string().nullish(),
      sender: z.string().nullish(),
      recipient: z.string().nullish(),
      reason: z.string().nullish(),
      receivedAt: z.string().nullish(),
    })
    .nullish(),
});

/** ID dolazne poruke za otkrivanje ponovljenih isporuka; bez ikakvog identifikatora poruka se ne dedupira. */
function inboundId(evt: z.infer<typeof eventSchema>, from: string) {
  const p = evt.payload ?? {};
  const id = p.messageId || evt.id;
  if (id) return `in:${id}`;
  if (p.receivedAt) return `in:h${createHash("sha256").update(`${from}|${p.receivedAt}|${p.message ?? ""}`).digest("hex").slice(0, 24)}`;
  return null;
}

export async function POST(req: Request) {
  const signingKey = env.smsGatewaySigningKey;
  if (!signingKey) return new Response("Not configured", { status: 503 });

  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  if (!verifyGatewaySignature(signingKey, raw, req.headers.get("x-signature"), req.headers.get("x-timestamp"))) {
    return new Response("Invalid signature", { status: 403 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return new Response("Bad payload", { status: 400 });
  const evt = parsed.data;
  const p = evt.payload ?? {};

  try {
    await ensureReviewsDb();
    switch (evt.event) {
      case "sms:received": {
        const from = gatewayPhoneCandidates(p.sender || p.phoneNumber || "");
        if (from.length > 0) {
          await handleSharedPhoneInbound({ from, to: p.recipient || "", body: p.message || "", providerSid: inboundId(evt, from[0]) });
        }
        break;
      }
      case "sms:sent":
        if (p.messageId) await applyDeliveryStatus(p.messageId, "SENT");
        break;
      case "sms:delivered":
        if (p.messageId) await applyDeliveryStatus(p.messageId, "DELIVERED");
        break;
      case "sms:failed":
        if (p.messageId) await applyDeliveryStatus(p.messageId, "FAILED", `Mobitel: ${(p.reason || "slanje nije uspjelo").slice(0, 200)}`);
        break;
    }
  } catch (e) {
    // Bez detalja prema van; 500 tjera aplikaciju da ponovi isporuku (obrada je idempotentna).
    console.error("[recenzije] NOVO mobitel webhook", evt.event, e instanceof Error ? e.name : typeof e);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
