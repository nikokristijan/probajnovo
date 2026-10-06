import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { Organization } from "@/lib/recenzije/db/schema";
import { decrypt } from "@/lib/recenzije/crypto";
import { env, integrations } from "@/lib/recenzije/env";

/**
 * Dva načina slanja SMS-a, bez ijednog ključa u pregledniku:
 *
 * 1. SMS Gateway for Android (github.com/capcom6/android-sms-gateway, Apache-2.0)
 *    — tvrtka na stari Android mobitel sa svojim SIM-om instalira aplikaciju i
 *    poruke idu s NJENOG broja, po cijeni njene tarife (često 0 € uz neograničene SMS-ove).
 *    Vjerodajnice se spremaju po tvrtki, šifrirane.
 * 2. Twilio — globalno, iz env varijabli (TWILIO_*), plaća se po poruci.
 *
 * Gateway tvrtke ima prednost; Twilio je rezerva za tvrtke bez mobitela.
 */
export class SmsNotConfiguredError extends Error {
  constructor() {
    super("Slanje SMS-a nije postavljeno. Povežite mobitel (SMS Gateway) u Postavkama ili dodajte Twilio ključeve.");
  }
}

export type SendResult = { sid: string; status: string; from: string | null };
type OrgSms = Pick<Organization, "smsGatewayUser" | "smsGatewayPassEnc">;

export function smsProvider(org: OrgSms): "gateway" | "twilio" | null {
  if (org.smsGatewayUser && org.smsGatewayPassEnc) return "gateway";
  if (integrations.twilio()) return "twilio";
  return null;
}

export async function sendSms(org: OrgSms, params: { to: string; body: string; statusCallback?: string }): Promise<SendResult> {
  const provider = smsProvider(org);
  if (provider === "gateway") return sendViaGateway(org, params);
  if (provider === "twilio") return sendViaTwilio(params);
  throw new SmsNotConfiguredError();
}

function gatewayAuth(org: OrgSms) {
  return "Basic " + Buffer.from(`${org.smsGatewayUser}:${decrypt(org.smsGatewayPassEnc!)}`).toString("base64");
}

async function sendViaGateway(org: OrgSms, params: { to: string; body: string }): Promise<SendResult> {
  const res = await fetch(`${env.smsGatewayApi}/message`, {
    method: "POST",
    headers: { Authorization: gatewayAuth(org), "Content-Type": "application/json" },
    body: JSON.stringify({ textMessage: { text: params.body }, phoneNumbers: [params.to], withDeliveryReport: true }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; state?: string; message?: string };
  if (res.status === 401) throw new Error("SMS Gateway: pogrešno korisničko ime ili lozinka (provjerite aplikaciju na mobitelu).");
  if (!res.ok || !json.id) throw new Error(`SMS Gateway: ${json.message || `greška ${res.status}`}`);
  return { sid: json.id, status: (json.state || "pending").toLowerCase(), from: null };
}

/** Provjerava vjerodajnice i registrira webhookove za odgovore i potvrde isporuke. */
export async function connectGateway(org: OrgSms & { id: string }) {
  const url = `${env.appUrl}/api/recenzije/webhooks/sms-gateway/${org.id}`;
  for (const event of ["sms:received", "sms:sent", "sms:delivered", "sms:failed"]) {
    const res = await fetch(`${env.smsGatewayApi}/webhooks`, {
      method: "POST",
      headers: { Authorization: gatewayAuth(org), "Content-Type": "application/json" },
      body: JSON.stringify({ id: `nr-${org.id}-${event.replace(":", "-")}`, url, event }),
    });
    if (res.status === 401) throw new Error("Pogrešno korisničko ime ili lozinka iz aplikacije SMS Gateway.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`SMS Gateway webhook (${event}): ${res.status} ${t.slice(0, 120)}`);
    }
  }
}

/** HMAC-SHA256(signingKey, rawBody + timestamp) u hex obliku, uz toleranciju od 5 minuta. */
export function verifyGatewaySignature(signingKey: string, rawBody: string, signature: string | null, timestamp: string | null) {
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", signingKey).update(rawBody + timestamp).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sendViaTwilio(params: { to: string; body: string; statusCallback?: string }): Promise<SendResult> {
  const form = new URLSearchParams({ To: params.to, Body: params.body });
  if (env.twilioMessagingServiceSid) form.set("MessagingServiceSid", env.twilioMessagingServiceSid);
  else form.set("From", env.twilioFrom);
  if (params.statusCallback) form.set("StatusCallback", params.statusCallback);

  const res = await fetch(`${env.twilioApiBase}/2010-04-01/Accounts/${env.twilioSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; from?: string; message?: string; code?: number };
  if (!res.ok || !json.sid) {
    throw new Error(json.message ? `Twilio: ${json.message}${json.code ? ` (${json.code})` : ""}` : `Twilio greška (${res.status})`);
  }
  return { sid: json.sid, status: json.status || "queued", from: json.from ?? null };
}

/**
 * X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sortirani ključ+vrijednost)).
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature || !env.twilioToken) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = createHmac("sha1", env.twilioToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function mapTwilioStatus(s: string): "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "UNDELIVERED" {
  switch (s) {
    case "delivered":
      return "DELIVERED";
    case "failed":
      return "FAILED";
    case "undelivered":
      return "UNDELIVERED";
    case "sent":
      return "SENT";
    default:
      return "QUEUED";
  }
}
