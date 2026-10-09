import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { Organization } from "@/lib/recenzije/db/schema";
import { decrypt } from "@/lib/recenzije/crypto";
import { env, integrations } from "@/lib/recenzije/env";
import type { SmsProviderName } from "@/lib/recenzije/sms-format";
import { TWILIO_SENDER_PREFIX, describeTwilioError, resolveTwilioSender } from "@/lib/recenzije/twilio";

/**
 * Slanje SMS-a, bez ijednog ključa u pregledniku. Redoslijed pružatelja:
 *
 * 1. Mobitel same tvrtke (stariji način, i dalje radi): vjerodajnice SMS Gatewaya spremljene
 *    po tvrtki, šifrirane. Poruke idu s tog broja.
 * 2. NOVO mobitel: JEDAN zajednički mobitel agencije (SMS Gateway for Android,
 *    github.com/capcom6/android-sms-gateway, Apache-2.0) za sve klijente. Vjerodajnice su u env
 *    varijablama (SMS_GATEWAY_USER, SMS_GATEWAY_PASSWORD), ne u bazi. Klijent nema nikakvo postavljanje;
 *    tekst poruke imenuje njegovu tvrtku.
 * 3. Twilio — globalno, iz env varijabli (TWILIO_*), plaća se po poruci. Pošiljatelj je broj (E.164),
 *    alfanumerička oznaka (npr. NOVO) ili Messaging Service; vidi lib/recenzije/twilio.ts. U Hrvatskoj
 *    Twilio ne podržava dvosmjerni SMS, pa se u poruku dodaje poveznica za odjavu (messaging.ts).
 *
 * Ako ništa nije postavljeno, slanje završava greškom SmsNotConfiguredError, a poruka se sprema kao
 * FAILED s tim razlogom (vidi messaging.ts).
 */
export class SmsNotConfiguredError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Slanje SMS-a nije postavljeno: u postavkama servera treba postaviti Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) ili NOVO mobitel (SMS_GATEWAY_USER, SMS_GATEWAY_PASSWORD)."
    );
    this.name = "SmsNotConfiguredError";
  }
}

export type SendResult = { sid: string; status: string; from: string | null };
export type SmsProvider = SmsProviderName;
type OrgSms = Pick<Organization, "smsGatewayUser" | "smsGatewayPassEnc">;

/**
 * Oznaka u messages.from_number za poruke poslane preko zajedničkog NOVO mobitela. Po njoj webhook
 * (sms-gateway/novo) zna kojoj tvrtki pripada odgovor na dolazni SMS, jer svi klijenti dijele isti broj.
 */
export const NOVO_SENDER = "NOVO";

export function smsProvider(org?: OrgSms | null): SmsProvider | null {
  if (org?.smsGatewayUser && org.smsGatewayPassEnc) return "gateway";
  if (integrations.novoPhone()) return "novo";
  if (integrations.twilio()) return "twilio";
  return null;
}

export async function sendSms(
  org: OrgSms | null | undefined,
  params: { to: string; body: string; statusCallback?: string }
): Promise<SendResult> {
  const provider = smsProvider(org);
  if (provider === "gateway") return sendViaOrgGateway(org!, params);
  if (provider === "novo") return sendViaNovoPhone(params);
  if (provider === "twilio") return sendViaTwilio(params);
  throw new SmsNotConfiguredError();
}

// --- SMS Gateway for Android (mobitel tvrtke i zajednički NOVO mobitel) ---

const GATEWAY_TIMEOUT_MS = 15_000;
const GATEWAY_EVENTS = ["sms:received", "sms:sent", "sms:delivered", "sms:failed"] as const;

const basicAuth = (user: string, password: string) => "Basic " + Buffer.from(`${user}:${password}`).toString("base64");

function orgGatewayAuth(org: OrgSms) {
  return basicAuth(org.smsGatewayUser!, decrypt(org.smsGatewayPassEnc!));
}

/** Basic autorizacija za zajednički NOVO mobitel iz env varijabli. */
export function novoGatewayAuth() {
  if (!integrations.novoPhone()) throw new SmsNotConfiguredError();
  return basicAuth(env.smsGatewayUser, env.smsGatewayPassword);
}

const ORG_UNAUTHORIZED = "SMS Gateway: pogrešno korisničko ime ili lozinka (provjerite aplikaciju na mobitelu).";
export const NOVO_UNAUTHORIZED =
  "SMS Gateway: pogrešno korisničko ime ili lozinka NOVO mobitela (provjerite SMS_GATEWAY_USER i SMS_GATEWAY_PASSWORD).";

/** fetch prema SMS Gateway API-ju s rokom i čitljivom porukom kad poslužitelj nije dostupan. */
export async function gatewayFetch(path: string, authorization: string, init: { method: string; body?: unknown }): Promise<Response> {
  try {
    return await fetch(`${env.smsGatewayApi}${path}`, {
      method: init.method,
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new Error(`SMS Gateway nije dostupan (${timeout ? "istek vremena" : "greška mreže"}). Pokušajte ponovno.`);
  }
}

async function postGatewayMessage(authorization: string, params: { to: string; body: string }, unauthorized: string) {
  const res = await gatewayFetch("/message", authorization, {
    method: "POST",
    body: { textMessage: { text: params.body }, phoneNumbers: [params.to], withDeliveryReport: true },
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; state?: string; message?: string };
  if (res.status === 401) throw new Error(unauthorized);
  if (res.status === 429) throw new Error("SMS Gateway: previše zahtjeva odjednom, pokušajte za nekoliko minuta.");
  if (!res.ok || !json.id) throw new Error(`SMS Gateway: ${json.message ? String(json.message).slice(0, 200) : `greška ${res.status}`}`);
  return { sid: json.id, status: (json.state || "pending").toLowerCase() };
}

async function sendViaOrgGateway(org: OrgSms, params: { to: string; body: string }): Promise<SendResult> {
  const res = await postGatewayMessage(orgGatewayAuth(org), params, ORG_UNAUTHORIZED);
  return { ...res, from: null };
}

/**
 * Slanje preko zajedničkog NOVO mobitela. `from` je oznaka NOVO_SENDER (a ne broj) jer se po njoj kasnije
 * prepoznaju odgovori i potvrde isporuke; potvrde se i inače uparuju po messages.provider_sid.
 */
export async function sendViaNovoPhone(params: { to: string; body: string }): Promise<SendResult> {
  const res = await postGatewayMessage(novoGatewayAuth(), params, NOVO_UNAUTHORIZED);
  return { ...res, from: NOVO_SENDER };
}

/**
 * Upisuje webhookove (odgovori, poslano, isporučeno, neuspjelo) na zadani URL. ID-evi su stabilni, pa
 * ponovno pokretanje samo prepiše postojeće umjesto da napravi duplikate.
 */
export async function registerGatewayWebhooks(authorization: string, opts: { idPrefix: string; url: string; unauthorized: string }) {
  for (const event of GATEWAY_EVENTS) {
    const res = await gatewayFetch("/webhooks", authorization, {
      method: "POST",
      body: { id: `${opts.idPrefix}-${event.replace(":", "-")}`, url: opts.url, event },
    });
    if (res.status === 401) throw new Error(opts.unauthorized);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`SMS Gateway webhook (${event}): ${res.status} ${t.slice(0, 120)}`.trim());
    }
  }
}

/** HMAC-SHA256(signingKey, rawBody + timestamp) u hex obliku, uz toleranciju od 5 minuta. */
export function verifyGatewaySignature(signingKey: string, rawBody: string, signature: string | null, timestamp: string | null) {
  if (!signingKey || !signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", signingKey).update(rawBody + timestamp).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Twilio ---

const TWILIO_TIMEOUT_MS = 15_000;

/** Greška Twilio REST API-ja; `message` je već čitljiva (hrvatska uputa za česte kodove), `code` je Twilio kod. */
export class TwilioApiError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly httpStatus: number
  ) {
    super(message);
    this.name = "TwilioApiError";
  }
}

const twilioAuth = () => "Basic " + Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString("base64");

async function twilioFetch(path: string, init: { method: string; body?: URLSearchParams }): Promise<Response> {
  try {
    return await fetch(`${env.twilioApiBase}/2010-04-01/Accounts/${env.twilioSid}${path}`, {
      method: init.method,
      headers: {
        Authorization: twilioAuth(),
        ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: init.body,
      signal: AbortSignal.timeout(TWILIO_TIMEOUT_MS),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new Error(`Twilio nije dostupan (${timeout ? "istek vremena" : "greška mreže"}). Pokušajte ponovno.`);
  }
}

type TwilioJson = {
  sid?: string;
  status?: string;
  from?: string | null;
  to?: string;
  message?: string;
  code?: number;
  error_code?: number | null;
  error_message?: string | null;
  num_segments?: string | null;
  price?: string | null;
  price_unit?: string | null;
};

async function sendViaTwilio(params: { to: string; body: string; statusCallback?: string }): Promise<SendResult> {
  const sender = resolveTwilioSender(env.twilioFrom, env.twilioMessagingServiceSid);
  if (sender.mode === "invalid") throw new SmsNotConfiguredError(`Twilio pošiljatelj nije ispravan: ${sender.error}`);
  if (sender.mode === "none") throw new SmsNotConfiguredError();

  const form = new URLSearchParams({ To: params.to, Body: params.body });
  if (sender.mode === "messaging_service") form.set("MessagingServiceSid", sender.value);
  else form.set("From", sender.sender.value);
  if (params.statusCallback) form.set("StatusCallback", params.statusCallback);

  const res = await twilioFetch("/Messages.json", { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as TwilioJson;
  if (!res.ok || !json.sid) {
    throw new TwilioApiError(describeTwilioError({ code: json.code, message: json.message, status: res.status }), json.code ?? null, res.status);
  }
  // Oznaka u messages.from_number razlikuje Twilio od zajedničkog Android mobitela (NOVO_SENDER), čak i kad je
  // alfanumerička oznaka isto "NOVO": po njoj se odgovori i STOP usmjeravaju bez dvosmislenosti.
  const used = json.from || (sender.mode === "from" ? sender.sender.value : sender.value);
  return { sid: json.sid, status: json.status || "queued", from: `${TWILIO_SENDER_PREFIX}${used}` };
}

export type TwilioMessageInfo = {
  status: string;
  errorCode: number | null;
  errorMessage: string | null;
  segments: number | null;
  price: string | null;
  priceUnit: string | null;
};

/** Trenutno stanje poruke kod Twilija (za provjeru probnog SMS-a: je li stvarno isporučena i zašto nije). */
export async function fetchTwilioMessage(messageSid: string): Promise<TwilioMessageInfo> {
  if (!integrations.twilio()) throw new SmsNotConfiguredError();
  const res = await twilioFetch(`/Messages/${encodeURIComponent(messageSid)}.json`, { method: "GET" });
  const json = (await res.json().catch(() => ({}))) as TwilioJson;
  if (!res.ok) throw new TwilioApiError(describeTwilioError({ code: json.code, message: json.message, status: res.status }), json.code ?? null, res.status);
  return {
    status: json.status || "unknown",
    errorCode: json.error_code ?? null,
    errorMessage: json.error_message ?? null,
    segments: json.num_segments ? Number(json.num_segments) : null,
    price: json.price ?? null,
    priceUnit: json.price_unit ?? null,
  };
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
