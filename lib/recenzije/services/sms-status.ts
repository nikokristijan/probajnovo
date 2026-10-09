import "server-only";
import { env } from "@/lib/recenzije/env";
import { TWILIO_HR_USD_PER_SEGMENT } from "@/lib/recenzije/sms-format";
import { smsSegments } from "@/lib/recenzije/messages";
import { toE164 } from "@/lib/recenzije/phone";
import { publicHttpsProblem, resolveTwilioSender, senderLabel, twilioHint } from "@/lib/recenzije/twilio";
import { getNovoPhoneStatus, type NovoPhoneStatus } from "./novo-phone";
import { fetchTwilioMessage, sendSms, SmsNotConfiguredError, smsProvider } from "./sms";

/**
 * Stanje SMS pošiljatelja za NOVO admin: koji je pružatelj AKTIVAN (isti redoslijed kao smsProvider:
 * NOVO Android mobitel, pa Twilio), što mu fali (imena env varijabli), je li pošiljatelj ispravan i može li se
 * isporuka pratiti. Čita samo env, bez mreže, pa je bezopasno zvati pri svakom prikazu stranice.
 */

export type SmsActive = "novo" | "twilio" | "none";
/** zeleno / žuto / crveno */
export type SmsLevel = "ok" | "warn" | "error";

export type TwilioStatus = {
  /** Račun i ispravan pošiljatelj su postavljeni: Twilio može slati. */
  configured: boolean;
  /** Imena env varijabli koje fale. */
  missing: string[];
  /** Što je pošiljatelj: broj, oznaka (bez broja), Messaging Service, nepostavljen ili neispravan. */
  senderKind: "number" | "alpha" | "messaging_service" | "none" | "invalid";
  senderLabel: string | null;
  /** Razlog zašto vrijednost pošiljatelja nije ispravna. */
  senderError: string | null;
  statusCallbackUrl: string;
  statusCallbackUsable: boolean;
  statusCallbackProblem: string | null;
  inboundUrl: string;
  usdPerSegment: number;
};

export type SmsSenderStatus = {
  active: SmsActive;
  level: SmsLevel;
  /** Kratak naslov stanja za značku. */
  summary: string;
  /** Konkretni problemi i upozorenja, najvažniji prvi. */
  problems: string[];
  /** Je li spreman za slanje (aktivan pružatelj postoji). */
  ready: boolean;
  /** Što stvarno rade odgovori klijenata na aktivnom pružatelju. */
  repliesLine: string;
  novo: NovoPhoneStatus;
  twilio: TwilioStatus;
};

const CALLBACK_PATH = "/api/recenzije/webhooks/twilio/status";
const INBOUND_PATH = "/api/recenzije/webhooks/twilio/inbound";

export const REPLIES_TWILIO = "Odgovori klijenata: ne rade s Twilijem u Hrvatskoj; odjava ide poveznicom u poruci.";
export const REPLIES_NOVO = "Odgovori klijenata: rade (stižu na NOVO mobitel kroz webhook); odjava je odgovorom STOP.";

export function getTwilioStatus(): TwilioStatus {
  const sender = resolveTwilioSender(env.twilioFrom, env.twilioMessagingServiceSid);
  const missing: string[] = [];
  if (!env.twilioSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!env.twilioToken) missing.push("TWILIO_AUTH_TOKEN");
  if (sender.mode === "none") missing.push("TWILIO_PHONE_NUMBER ili TWILIO_MESSAGING_SERVICE_SID");

  const callbackUrl = `${env.appUrl}${CALLBACK_PATH}`;
  const callbackProblem = publicHttpsProblem(env.appUrl);
  const kind: TwilioStatus["senderKind"] =
    sender.mode === "messaging_service" ? "messaging_service" : sender.mode === "from" ? sender.sender.kind : sender.mode === "invalid" ? "invalid" : "none";

  return {
    configured: Boolean(env.twilioSid && env.twilioToken && (sender.mode === "messaging_service" || sender.mode === "from")),
    missing,
    senderKind: kind,
    senderLabel: senderLabel(sender),
    senderError: sender.mode === "invalid" ? sender.error : null,
    statusCallbackUrl: callbackUrl,
    statusCallbackUsable: callbackProblem === null,
    statusCallbackProblem: callbackProblem,
    inboundUrl: `${env.appUrl}${INBOUND_PATH}`,
    usdPerSegment: TWILIO_HR_USD_PER_SEGMENT,
  };
}

export function getSmsSenderStatus(): SmsSenderStatus {
  const novo = getNovoPhoneStatus();
  const twilio = getTwilioStatus();
  const provider = smsProvider(null);
  const active: SmsActive = provider === "novo" ? "novo" : provider === "twilio" ? "twilio" : "none";
  const problems: string[] = [];
  let level: SmsLevel = "ok";
  let summary = "";
  const warn = (text: string) => {
    problems.push(text);
    if (level === "ok") level = "warn";
  };

  if (active === "none") {
    level = "error";
    summary = twilio.senderError ? "Twilio pošiljatelj nije ispravan" : "Nije postavljeno";
    problems.push(
      twilio.senderError
        ? `Twilio pošiljatelj nije ispravan: ${twilio.senderError}`
        : "Nijedan SMS pružatelj nije postavljen, pa se SMS ne mogu slati."
    );
  } else if (active === "twilio") {
    summary = "Twilio";
    if (!twilio.statusCallbackUsable) {
      // Isti uvjet blokira slanje klijentima (messaging.ts): poveznica za odjavu u poruci mora biti dostupna.
      level = "error";
      problems.push(
        `Slanje klijentima je blokirano jer poveznice za recenziju i odjavu u poruci ne bi radile, a statusi isporuke se ne bi ažurirali: ${twilio.statusCallbackProblem}. Postavite NR_APP_URL na javnu https adresu stranice (trenutno ${env.appUrl}). Probni SMS radi i dalje.`
      );
    }
    if (twilio.senderKind === "alpha") {
      problems.push(
        "Pošiljatelj je oznaka (bez broja): primatelj ne može odgovoriti. Izvori se razilaze oko prethodne registracije oznake za Hrvatsku, pa je potvrdite probnim SMS-om."
      );
    }
    if (!novo.configured && novo.missing.length < 2) {
      warn(`Android mobitel je napola postavljen (fali ${novo.missing.join(", ")}). Dok ne bude potpun, šalje se preko Twilija.`);
    }
  } else {
    summary = "NOVO mobitel";
    if (!novo.signingKeyConfigured) {
      warn("Nije postavljen SMS_GATEWAY_SIGNING_KEY: slanje radi, ali se odgovori i potvrde isporuke odbijaju.");
    }
    if (twilio.senderError) warn(`Twilio pošiljatelj nije ispravan: ${twilio.senderError}`);
    if (twilio.configured) {
      problems.push("Twilio je također postavljen, ali Android mobitel ima prednost dok su SMS_GATEWAY_USER i SMS_GATEWAY_PASSWORD postavljeni.");
    }
  }

  return {
    active,
    level,
    summary,
    problems,
    ready: active !== "none",
    repliesLine: active === "twilio" ? REPLIES_TWILIO : active === "novo" ? REPLIES_NOVO : "",
    novo,
    twilio,
  };
}

// --- Probni SMS ---

export type TestSmsResult = {
  provider: "novo" | "twilio";
  providerLabel: string;
  sid: string;
  status: string;
  /** Što je Twilio/mobitel prijavio kao pošiljatelja. */
  from: string | null;
  senderLabel: string | null;
  segments: number;
};

const TEST_BODY = "NOVO: probna poruka. Ako vidite ovu poruku, slanje SMS-a radi.";

/**
 * Pošalje probni SMS preko AKTIVNOG pružatelja (Android mobitel ili Twilio), samo za glavnog admina.
 * Prava Twilio greška (npr. 21408, 21612, 21614) vraća se čitljivo, s hrvatskom uputom.
 */
export async function sendTestSms(to: string): Promise<TestSmsResult> {
  const phone = toE164(to);
  if (!phone) throw new Error("Neispravan broj telefona. Upišite broj u obliku +385 91 234 5678.");
  const provider = smsProvider(null);
  if (!provider) {
    const tw = getTwilioStatus();
    throw new SmsNotConfiguredError(
      tw.senderError ? `Twilio pošiljatelj nije ispravan: ${tw.senderError}` : undefined
    );
  }
  const res = await sendSms(null, { to: phone, body: TEST_BODY });
  const tw = getTwilioStatus();
  return {
    provider: provider === "twilio" ? "twilio" : "novo",
    providerLabel: provider === "twilio" ? "Twilio" : "NOVO mobitel",
    sid: res.sid,
    status: res.status,
    from: res.from,
    senderLabel: provider === "twilio" ? tw.senderLabel : "NOVO mobitel (Android)",
    segments: smsSegments(TEST_BODY).segments,
  };
}

export type TestSmsCheck = {
  status: string;
  /** Čitljiv opis stanja: što znači i što napraviti ako nije isporučeno. */
  text: string;
  final: boolean;
  ok: boolean;
};

const STATUS_TEXT: Record<string, string> = {
  accepted: "Twilio je primio poruku i sprema je za slanje.",
  scheduled: "Poruka je zakazana.",
  queued: "Poruka čeka u Twilio redu. Provjerite ponovno za par sekundi.",
  sending: "Twilio šalje poruku operateru. Provjerite ponovno za par sekundi.",
  sent: "Poruka je predana operateru, potvrda isporuke još nije stigla (neki operateri je ne šalju).",
  delivered: "Poruka je isporučena na mobitel.",
  undelivered: "Poruka nije isporučena.",
  failed: "Slanje nije uspjelo.",
  canceled: "Slanje je otkazano.",
};

/** Provjera probnog SMS-a kod Twilija: status isporuke i, ako nije isporučen, razlog s uputom. */
export async function checkTestSmsStatus(sid: string): Promise<TestSmsCheck> {
  if (smsProvider(null) !== "twilio") {
    throw new Error("Provjera statusa vrijedi samo za Twilio. Za Android mobitel gledajte poruku na samom mobitelu.");
  }
  const m = await fetchTwilioMessage(sid);
  const final = ["delivered", "undelivered", "failed", "canceled"].includes(m.status);
  let text = STATUS_TEXT[m.status] ?? `Status: ${m.status}.`;
  if (m.errorCode) {
    text += ` Twilio kod ${m.errorCode}${m.errorMessage ? ` (${m.errorMessage})` : ""}.`;
    const hint = twilioHint(m.errorCode);
    if (hint) text += ` ${hint}`;
  }
  return { status: m.status, text, final, ok: m.status === "delivered" || (!final && !m.errorCode) };
}
