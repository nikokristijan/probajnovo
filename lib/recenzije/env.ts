import "server-only";
import { createHash } from "crypto";
import { resolveTextbeeApiBase } from "@/lib/recenzije/textbee";
import { isPublicHttpsUrl, resolveTwilioSender } from "@/lib/recenzije/twilio";

/**
 * Server-only postavke za NOVO Recenzije. Ništa odavde ne ide u preglednik.
 * Koristi iste varijable koje probajnovo već ima (DATABASE_URL, SESSION_SECRET,
 * RESEND_API_KEY, CRON_SECRET), a integracije se uključuju tek kad postoje
 * njihovi ključevi — sučelje tada prestaje prikazivati upute za postavljanje.
 */
function appUrl() {
  if (process.env.NR_APP_URL) return process.env.NR_APP_URL;
  if (process.env.VERCEL_ENV === "production") return "https://www.probajnovo.com";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Kratka javna adresa (npr. https://nvo.hr) koja pokazuje na ISTU stranicu; neobavezna. Koristi se samo
 * u tekstu SMS-a kad bi poveznica za odjavu inače gurnula poruku u više SMS-ova. Neispravna vrijednost
 * (nije javni https) se ignorira.
 */
function shortUrl() {
  const raw = (process.env.NR_SHORT_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return isPublicHttpsUrl(url) ? url : "";
}

/** Izvedeni ključevi: jedna tajna (SESSION_SECRET) → odvojeni ključ za svaku namjenu. */
export function derivedKey(purpose: string) {
  const secret = process.env.NR_SECRET || process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("SESSION_SECRET nije postavljen.");
  return createHash("sha256").update(`${purpose}:${secret}`).digest();
}

export const env = {
  appUrl: appUrl().replace(/\/$/, ""),
  shortUrl: shortUrl(),
  cronSecret: process.env.CRON_SECRET || "",

  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  /** Haiku je najjeftiniji i sasvim dovoljan za kratke SMS-ove. */
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",

  twilioSid: (process.env.TWILIO_ACCOUNT_SID || "").trim(),
  twilioToken: (process.env.TWILIO_AUTH_TOKEN || "").trim(),
  /** Broj u obliku E.164 (+385...) ILI alfanumerička oznaka pošiljatelja (npr. NOVO); vidi lib/recenzije/twilio.ts. */
  twilioFrom: (process.env.TWILIO_PHONE_NUMBER || "").trim(),
  twilioMessagingServiceSid: (process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim(),
  /** Samo za lokalno testiranje s lažnim serverom; produkcija uvijek ide na Twilio. */
  twilioApiBase: (process.env.TWILIO_API_BASE || "https://api.twilio.com").replace(/\/$/, ""),
  /** SMS Gateway for Android — javni cloud server (besplatan). */
  smsGatewayApi: (process.env.SMS_GATEWAY_API || "https://api.sms-gate.app/3rdparty/v1").replace(/\/$/, ""),
  /**
   * NOVO mobitel: jedan zajednički Android mobitel (SMS Gateway for Android) s kojeg odlaze SVE poruke
   * svih klijenata. Korisničko ime i lozinka su iz aplikacije na mobitelu (Cloud server), a potpisni ključ
   * je isti kao u aplikaciji pod Settings → Webhooks → Signing Key; bez njega se webhookovi (odgovori i
   * potvrde isporuke) odbijaju.
   */
  smsGatewayUser: (process.env.SMS_GATEWAY_USER || "").trim(),
  smsGatewayPassword: (process.env.SMS_GATEWAY_PASSWORD || "").trim(),
  smsGatewaySigningKey: (process.env.SMS_GATEWAY_SIGNING_KEY || "").trim(),

  /**
   * TextBee (textbee.dev): vlastiti mobitel s vlastitom SIM karticom i brojem, povezan preko TextBee aplikacije.
   * Ključ i ID uređaja iz TextBee nadzorne ploče su dovoljni za slanje. Tajna webhooka (ISTI niz koji se upisuje pri
   * stvaranju webhooka u TextBee nadzornoj ploči) uključuje primanje odgovora i potvrda isporuke; bez nje odgovori
   * (STOP) ne stižu pa se u poruku stavlja poveznica za odjavu. Ključ se NIKAD ne piše u repozitorij ni u log.
   */
  textbeeApiKey: (process.env.TEXTBEE_API_KEY || "").trim(),
  textbeeDeviceId: (process.env.TEXTBEE_DEVICE_ID || "").trim(),
  textbeeWebhookSecret: (process.env.TEXTBEE_WEBHOOK_SECRET || "").trim(),
  /** Samo za lokalno testiranje s lažnim poslužiteljem; produkcija uvijek ide na https://api.textbee.dev/api/v1. */
  textbeeApiBase: resolveTextbeeApiBase(process.env.TEXTBEE_API_BASE),

  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googlePlacesKey: process.env.GOOGLE_PLACES_API_KEY || "",

  stripeSecret: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",

  resendKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "NOVO <hello@probajnovo.com>",

  demoEnabled: process.env.NR_DEMO !== "false",
  /** Kontakt za aktivaciju paketa kad Stripe nije uključen. */
  salesEmail: process.env.NR_SALES_EMAIL || "hello@probajnovo.com",
};

export const integrations = {
  ai: () => Boolean(env.anthropicKey),
  /** Twilio može slati samo uz račun i ISPRAVAN pošiljatelj (broj, oznaka ili Messaging Service). */
  twilio: () => {
    if (!env.twilioSid || !env.twilioToken) return false;
    const sender = resolveTwilioSender(env.twilioFrom, env.twilioMessagingServiceSid);
    return sender.mode === "messaging_service" || sender.mode === "from";
  },
  /** Zajednički NOVO mobitel: dovoljni su korisničko ime i lozinka za slanje; potpisni ključ treba za webhookove. */
  novoPhone: () => Boolean(env.smsGatewayUser && env.smsGatewayPassword),
  /** TextBee može slati kad postoje API ključ i ID uređaja. */
  textbee: () => Boolean(env.textbeeApiKey && env.textbeeDeviceId),
  /** Dvosmjerni SMS preko TextBeea (odgovori, STOP, potvrde isporuke): uključen tek kad je postavljena tajna webhooka. */
  textbeeInbound: () => Boolean(env.textbeeWebhookSecret),
  googleOAuth: () => Boolean(env.googleClientId && env.googleClientSecret),
  googlePlaces: () => Boolean(env.googlePlacesKey),
  stripe: () => Boolean(env.stripeSecret),
  email: () => Boolean(env.resendKey),
};
