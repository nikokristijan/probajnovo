import "server-only";
import { env, integrations } from "@/lib/recenzije/env";
import { toE164 } from "@/lib/recenzije/phone";
import {
  NOVO_UNAUTHORIZED,
  SmsNotConfiguredError,
  gatewayFetch,
  novoGatewayAuth,
  registerGatewayWebhooks,
  sendViaNovoPhone,
} from "./sms";

/**
 * Jedan zajednički NOVO mobitel (SMS Gateway for Android) kojim se šalju SVE
 * poruke svih klijenata. Vjerodajnice su u env varijablama, ne u bazi:
 * SMS_GATEWAY_USER, SMS_GATEWAY_PASSWORD i SMS_GATEWAY_SIGNING_KEY.
 */
export type NovoPhoneStatus = {
  configured: boolean;
  /** Imena env varijabli koje još fale. */
  missing: string[];
  /** URL koji se upisuje kao webhook u aplikaciji / registrira gumbom u adminu. */
  webhookUrl: string;
  signingKeyConfigured: boolean;
};

const WEBHOOK_PATH = "/api/recenzije/webhooks/sms-gateway/novo";
/** Stabilni ID-evi webhookova na uređaju (nr-novo-sms-received, ...): ponovno povezivanje prepisuje, ne udvostručuje. */
const WEBHOOK_ID_PREFIX = "nr-novo";

const TEST_BODY = "NOVO: probna poruka. Ako vidite ovu poruku, slanje preko NOVO mobitela radi.";

/**
 * "configured" znači da se može slati (korisničko ime i lozinka). `missing` navodi samo te varijable;
 * potpisni ključ se prikazuje zasebno (signingKeyConfigured) jer slanje radi i bez njega, ali se
 * bez njega odgovori i potvrde isporuke odbijaju.
 */
export function getNovoPhoneStatus(): NovoPhoneStatus {
  const missing: string[] = [];
  if (!env.smsGatewayUser) missing.push("SMS_GATEWAY_USER");
  if (!env.smsGatewayPassword) missing.push("SMS_GATEWAY_PASSWORD");
  return {
    configured: missing.length === 0,
    missing,
    webhookUrl: `${env.appUrl}${WEBHOOK_PATH}`,
    signingKeyConfigured: Boolean(env.smsGatewaySigningKey),
  };
}

/** Pošalje probni SMS preko NOVO mobitela (samo za glavnog admina). */
export async function sendNovoTestSms(to: string): Promise<{ sid: string; status: string }> {
  const phone = toE164(to);
  if (!phone) throw new Error("Neispravan broj telefona. Upišite broj u obliku +385 91 234 5678.");
  if (!integrations.novoPhone()) throw new SmsNotConfiguredError();
  const res = await sendViaNovoPhone({ to: phone, body: TEST_BODY });
  return { sid: res.sid, status: res.status };
}

/**
 * Registrira webhookove (odgovori, poslano, isporučeno, neuspjelo) za NOVO mobitel na zajednički URL i,
 * ako API to podržava, prenosi potpisni ključ u aplikaciju (PATCH /settings → webhooks.signing_key).
 */
export async function registerNovoWebhooks(): Promise<void> {
  if (!integrations.novoPhone()) throw new SmsNotConfiguredError();
  if (!env.smsGatewaySigningKey) {
    throw new Error(
      "Nije postavljen SMS_GATEWAY_SIGNING_KEY. Bez potpisnog ključa webhookovi se odbijaju, pa ih nema smisla povezivati. Postavite ga na serveru (isti kao u aplikaciji) i pokušajte ponovno."
    );
  }
  const url = `${env.appUrl}${WEBHOOK_PATH}`;
  if (!url.startsWith("https://")) {
    throw new Error(
      `Webhook adresa mora biti javna https adresa, a trenutno je ${url}. Postavite NR_APP_URL na javnu adresu stranice (https://...).`
    );
  }

  const authorization = novoGatewayAuth();
  await registerGatewayWebhooks(authorization, { idPrefix: WEBHOOK_ID_PREFIX, url, unauthorized: NOVO_UNAUTHORIZED });
  await pushSigningKey(authorization);
}

/**
 * Prenosi potpisni ključ u aplikaciju preko Settings API-ja. Ne podržava ga svaka verzija aplikacije
 * ili servera, pa neuspjeh daje jasnu uputu za ručni unos umjesto da webhookovi tiho ostanu nepotpisani.
 */
async function pushSigningKey(authorization: string) {
  const manual =
    "U aplikaciji na mobitelu otvorite Settings → Webhooks → Signing Key i upišite vrijednost iz SMS_GATEWAY_SIGNING_KEY.";
  const res = await gatewayFetch("/settings", authorization, {
    method: "PATCH",
    body: { webhooks: { signing_key: env.smsGatewaySigningKey } },
  });
  if (res.status === 401) throw new Error(NOVO_UNAUTHORIZED);
  if (!res.ok) {
    throw new Error(`Webhookovi su upisani, ali potpisni ključ nije prenesen u aplikaciju (odgovor ${res.status}). ${manual}`);
  }
}
