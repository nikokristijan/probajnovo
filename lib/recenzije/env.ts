import "server-only";
import { createHash } from "crypto";

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

/** Izvedeni ključevi: jedna tajna (SESSION_SECRET) → odvojeni ključ za svaku namjenu. */
export function derivedKey(purpose: string) {
  const secret = process.env.NR_SECRET || process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("SESSION_SECRET nije postavljen.");
  return createHash("sha256").update(`${purpose}:${secret}`).digest();
}

export const env = {
  appUrl: appUrl().replace(/\/$/, ""),
  cronSecret: process.env.CRON_SECRET || "",

  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  /** Haiku je najjeftiniji i sasvim dovoljan za kratke SMS-ove. */
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",

  twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioFrom: process.env.TWILIO_PHONE_NUMBER || "",
  twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || "",
  /** Samo za lokalno testiranje s lažnim serverom; produkcija uvijek ide na Twilio. */
  twilioApiBase: (process.env.TWILIO_API_BASE || "https://api.twilio.com").replace(/\/$/, ""),
  /** SMS Gateway for Android — javni cloud server (besplatan). */
  smsGatewayApi: (process.env.SMS_GATEWAY_API || "https://api.sms-gate.app/3rdparty/v1").replace(/\/$/, ""),

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
  twilio: () => Boolean(env.twilioSid && env.twilioToken && (env.twilioFrom || env.twilioMessagingServiceSid)),
  googleOAuth: () => Boolean(env.googleClientId && env.googleClientSecret),
  googlePlaces: () => Boolean(env.googlePlacesKey),
  stripe: () => Boolean(env.stripeSecret),
  email: () => Boolean(env.resendKey),
};
