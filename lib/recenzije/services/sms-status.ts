import "server-only";
import { env, integrations } from "@/lib/recenzije/env";
import { TWILIO_HR_USD_PER_SEGMENT } from "@/lib/recenzije/sms-format";
import { smsSegments } from "@/lib/recenzije/messages";
import { toE164 } from "@/lib/recenzije/phone";
import { TEXTBEE_SECRET_MIN_LENGTH, TEXTBEE_WEBHOOK_PATH, textbeeSenderMarker } from "@/lib/recenzije/textbee";
import { publicHttpsProblem, resolveTwilioSender, senderLabel, twilioHint } from "@/lib/recenzije/twilio";
import { getNovoPhoneStatus, type NovoPhoneStatus } from "./novo-phone";
import { needsOptOutLink } from "@/lib/recenzije/sms-format";
import { fetchTwilioMessage, sendSms, SmsNotConfiguredError, smsProvider, smsSenderKind, type OrgSms } from "./sms";

/**
 * Stanje SMS pošiljatelja za NOVO admin: koji je pružatelj AKTIVAN (isti redoslijed kao smsProvider:
 * NOVO Android mobitel, pa TextBee, pa Twilio), što mu fali (imena env varijabli), je li pošiljatelj ispravan i može li se
 * isporuka pratiti. Čita samo env, bez mreže, pa je bezopasno zvati pri svakom prikazu stranice.
 */

export type SmsActive = "novo" | "textbee" | "twilio" | "none";
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

export type TextbeeStatus = {
  /** Ključ i ID uređaja su postavljeni: TextBee može slati. */
  configured: boolean;
  /** Imena env varijabli koje fale (webhook tajna je neobavezna pa se ne računa). */
  missing: string[];
  /** Tajna webhooka je postavljena: odgovori (STOP) i potvrde isporuke se primaju. */
  repliesEnabled: boolean;
  /** Tajna je kraća od onoga što TextBee, prema dokumentaciji, traži (samo upozorenje). */
  secretTooShort: boolean;
  /** Oznaka u poruci (messages.from_number), ako je ID uređaja postavljen. */
  marker: string | null;
  /** Adresa koju vlasnik upisuje u TextBee nadzornu ploču (Webhooks). */
  webhookUrl: string;
  webhookUrlUsable: boolean;
  webhookUrlProblem: string | null;
  /** Događaji koje treba označiti pri stvaranju webhooka. */
  webhookEvents: string[];
  /** Je li poruci potrebna poveznica za odjavu (nema webhooka pa STOP ne stiže). */
  optOutLink: boolean;
  secretMinLength: number;
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
  textbee: TextbeeStatus;
  twilio: TwilioStatus;
};

const CALLBACK_PATH = "/api/recenzije/webhooks/twilio/status";
const INBOUND_PATH = "/api/recenzije/webhooks/twilio/inbound";

export const REPLIES_TWILIO = "Odgovori klijenata: ne rade s Twilijem u Hrvatskoj; odjava ide poveznicom u poruci.";
export const REPLIES_NOVO = "Odgovori klijenata: rade (stižu na NOVO mobitel kroz webhook); odjava je odgovorom STOP.";
export const REPLIES_TEXTBEE = "Odgovori klijenata: rade (stižu preko TextBee webhooka); odjava je odgovorom STOP.";
export const REPLIES_TEXTBEE_UNREACHABLE =
  "Odgovori klijenata: ne mogu stići jer adresa webhooka nije javna (TextBee je ne može dosegnuti); poruke u tom slučaju nemaju poveznicu za odjavu.";
export const REPLIES_TEXTBEE_NO_WEBHOOK =
  "Odgovori klijenata: nisu uključeni jer nema TextBee webhooka (TEXTBEE_WEBHOOK_SECRET); odjava ide poveznicom u poruci.";

/** Savjet kad TextBee radi bez webhooka (TEXTBEE_WEBHOOK_SECRET): poruke nose poveznicu za odjavu umjesto upute "Za odjavu napišite STOP.". */
export const TEXTBEE_NO_WEBHOOK_HINT =
  "Poruke nose poveznicu za odjavu. Za ljepšu poruku (odjava odgovorom STOP) uključite webhook i postavite TEXTBEE_WEBHOOK_SECRET.";

/** Događaji koje treba označiti u TextBee nadzornoj ploči (UNCONFIRMED imena su u lib/recenzije/textbee.ts). */
export const TEXTBEE_EVENTS = ["MESSAGE_RECEIVED", "MESSAGE_SENT", "MESSAGE_DELIVERED", "MESSAGE_FAILED"];

export function getTextbeeStatus(): TextbeeStatus {
  const missing: string[] = [];
  if (!env.textbeeApiKey) missing.push("TEXTBEE_API_KEY");
  if (!env.textbeeDeviceId) missing.push("TEXTBEE_DEVICE_ID");
  const repliesEnabled = integrations.textbeeInbound();
  const webhookProblem = publicHttpsProblem(env.appUrl);
  return {
    configured: missing.length === 0,
    missing,
    repliesEnabled,
    secretTooShort: repliesEnabled && env.textbeeWebhookSecret.length < TEXTBEE_SECRET_MIN_LENGTH,
    marker: env.textbeeDeviceId ? textbeeSenderMarker(env.textbeeDeviceId) : null,
    webhookUrl: `${env.appUrl}${TEXTBEE_WEBHOOK_PATH}`,
    webhookUrlUsable: webhookProblem === null,
    webhookUrlProblem: webhookProblem,
    webhookEvents: TEXTBEE_EVENTS,
    optOutLink: needsOptOutLink("textbee", { textbeeReplies: repliesEnabled }),
    secretMinLength: TEXTBEE_SECRET_MIN_LENGTH,
  };
}

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

/** Jedna od dvije TextBee varijable je postavljena, a druga ne: korisnik je vjerojatno zaboravio drugu. */
const textbeePartial = (t: TextbeeStatus) => !t.configured && t.missing.length < 2;

export function getSmsSenderStatus(): SmsSenderStatus {
  const novo = getNovoPhoneStatus();
  const textbee = getTextbeeStatus();
  const twilio = getTwilioStatus();
  const provider = smsProvider(null);
  const active: SmsActive = provider === "novo" ? "novo" : provider === "textbee" ? "textbee" : provider === "twilio" ? "twilio" : "none";
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
    if (textbeePartial(textbee)) problems.push(`TextBee je napola postavljen (fali ${textbee.missing.join(", ")}).`);
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
    if (textbeePartial(textbee)) {
      warn(`TextBee je napola postavljen (fali ${textbee.missing.join(", ")}). Dok ne bude potpun, šalje se preko Twilija.`);
    }
  } else if (active === "textbee") {
    summary = "TextBee";
    if (textbee.optOutLink && !textbee.webhookUrlUsable) {
      // Isti uvjet blokira slanje klijentima (messaging.ts): bez webhooka poveznica za odjavu u poruci mora biti dostupna.
      level = "error";
      problems.push(
        `Slanje klijentima je blokirano jer poveznice za recenziju i odjavu u poruci ne bi radile: ${textbee.webhookUrlProblem}. Postavite NR_APP_URL na javnu https adresu stranice (trenutno ${env.appUrl}). Probni SMS radi i dalje.`
      );
    }
    if (!textbee.repliesEnabled) problems.push(TEXTBEE_NO_WEBHOOK_HINT);
    if (textbee.repliesEnabled && !textbee.webhookUrlUsable) {
      // Tajna je postavljena pa poruke ne nose poveznicu za odjavu, a TextBee ne može dostaviti webhook na nejavnu adresu.
      warn(
        `Webhook adresa nije javna (${textbee.webhookUrlProblem}): TextBee je ne može dosegnuti, pa odgovor STOP i potvrde isporuke neće stići, a poruke ne nose poveznicu za odjavu. Postavite NR_APP_URL na javnu https adresu ili uklonite TEXTBEE_WEBHOOK_SECRET prije slanja klijentima.`
      );
    }
    if (textbee.secretTooShort) {
      warn(`TEXTBEE_WEBHOOK_SECRET ima manje od ${textbee.secretMinLength} znakova, a TextBee prema dokumentaciji traži najmanje toliko. Ako TextBee odbije tajnu, upišite dulju na oba mjesta.`);
    }
    if (!novo.configured && novo.missing.length < 2) {
      warn(`Android mobitel je napola postavljen (fali ${novo.missing.join(", ")}). Dok ne bude potpun, šalje se preko TextBeea.`);
    }
    if (twilio.senderError) warn(`Twilio pošiljatelj nije ispravan: ${twilio.senderError}`);
    if (twilio.configured) {
      problems.push("Twilio je također postavljen, ali TextBee ima prednost dok su TEXTBEE_API_KEY i TEXTBEE_DEVICE_ID postavljeni.");
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
    if (textbee.configured) {
      problems.push("TextBee je također postavljen, ali Android mobitel ima prednost dok su SMS_GATEWAY_USER i SMS_GATEWAY_PASSWORD postavljeni.");
    }
  }

  return {
    active,
    level,
    summary,
    problems,
    ready: active !== "none",
    repliesLine:
      active === "twilio"
        ? REPLIES_TWILIO
        : active === "novo"
          ? REPLIES_NOVO
          : active === "textbee"
            ? textbee.repliesEnabled
              ? textbee.webhookUrlUsable
                ? REPLIES_TEXTBEE
                : REPLIES_TEXTBEE_UNREACHABLE
              : REPLIES_TEXTBEE_NO_WEBHOOK
            : "",
    novo,
    textbee,
    twilio,
  };
}

// --- Probni SMS ---

export type TestSmsResult = {
  provider: "novo" | "textbee" | "twilio" | "gateway";
  providerLabel: string;
  sid: string;
  status: string;
  /** Što je Twilio/mobitel prijavio kao pošiljatelja. */
  from: string | null;
  senderLabel: string | null;
  segments: number;
  /** Šalje li se s mobitela same tvrtke (TextBee ili Android), a ne sa zajedničkog pošiljatelja. */
  ownPhone: boolean;
};

const TEST_BODY = "NOVO: probna poruka. Ako vidite ovu poruku, slanje SMS-a radi.";

/**
 * Pošalje probni SMS preko AKTIVNOG pružatelja (Android mobitel, TextBee ili Twilio), samo za glavnog admina. Bez `org` to je zajednički
 * pošiljatelj; s `org` pružatelj te tvrtke (njezin TextBee mobitel ima prednost i nema vraćanja na drugi pružatelj).
 * Prava Twilio greška (npr. 21408, 21612, 21614) vraća se čitljivo, s hrvatskom uputom.
 */
export async function sendTestSms(to: string, org: OrgSms | null = null): Promise<TestSmsResult> {
  const phone = toE164(to);
  if (!phone) throw new Error("Neispravan broj telefona. Upišite broj u obliku +385 91 234 5678.");
  const kind = smsSenderKind(org);
  if (kind === "none") {
    const tw = getTwilioStatus();
    throw new SmsNotConfiguredError(
      tw.senderError ? `Twilio pošiljatelj nije ispravan: ${tw.senderError}` : undefined
    );
  }
  const res = await sendSms(org, { to: phone, body: TEST_BODY });
  const tw = getTwilioStatus();
  const shown =
    kind === "twilio"
      ? { provider: "twilio" as const, providerLabel: "Twilio", senderLabel: tw.senderLabel }
      : kind === "org_textbee"
        ? { provider: "textbee" as const, providerLabel: "TextBee (mobitel klijenta)", senderLabel: "mobitel i SIM ovog klijenta (TextBee)" }
        : kind === "textbee"
          ? { provider: "textbee" as const, providerLabel: "TextBee", senderLabel: "vaš mobitel i SIM (TextBee)" }
          : kind === "org_gateway"
            ? { provider: "gateway" as const, providerLabel: "Android mobitel klijenta", senderLabel: "mobitel ovog klijenta (Android)" }
            : { provider: "novo" as const, providerLabel: "NOVO mobitel", senderLabel: "NOVO mobitel (Android)" };
  return {
    ...shown,
    sid: res.sid,
    status: res.status,
    from: res.from,
    segments: smsSegments(TEST_BODY).segments,
    ownPhone: kind === "org_textbee" || kind === "org_gateway",
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
    throw new Error("Provjera statusa vrijedi samo za Twilio. Za Android mobitel i TextBee gledajte poruku na samom mobitelu.");
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
