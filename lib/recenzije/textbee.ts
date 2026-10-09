/**
 * Čista logika oko TextBeea (textbee.dev): Android aplikacija na mobitelu + oblak s REST API-jem. Bez poziva prema mreži,
 * bez crypto modula i bez server-only, da je smiju koristiti env.ts, servisi, admin sučelje i testovi.
 * Ništa ovdje ne čita tajne: vrijednosti stižu kao argumenti.
 *
 * SVE PRETPOSTAVKE O TUĐEM API-JU SU U OVOJ DATOTECI, na jednom mjestu. Javna dokumentacija se razilazi sama sa sobom
 * (npr. potpis webhooka, oblik odgovora), a stvarni odgovori nisu provjereni, pa je kod namjerno tolerantan:
 * prihvaća više oblika odgovora i ne oslanja se na polja koja nisu sigurna. Popis i izvori: textbee-api-notes.md
 * (oznaka UNCONFIRMED = nije potvrđeno u dokumentaciji).
 */

// --- Adrese i konstante ---

/** CONFIRMED: https://textbee.dev/docs/sending-sms, https://textbee.dev/docs/api-reference */
export const TEXTBEE_DEFAULT_API_BASE = "https://api.textbee.dev/api/v1";

/** Rok za svaki poziv prema TextBee API-ju. */
export const TEXTBEE_TIMEOUT_MS = 15_000;

/** Prefiks u messages.from_number za poruke poslane preko TextBeea (npr. "textbee:a1b2"); kao "twilio:" kod Twilija. */
export const TEXTBEE_SENDER_PREFIX = "textbee:";

/** Adresa našeg webhooka (apsolutni URL = env.appUrl + ovo) koju vlasnik upisuje u TextBee nadzornu ploču. */
export const TEXTBEE_WEBHOOK_PATH = "/api/recenzije/webhooks/textbee";

/**
 * UNCONFIRMED (jedan izvor): potpisna tajna webhooka mora imati barem 20 znakova. Služi samo za upozorenje u adminu;
 * nikad ne blokira slanje ni primanje.
 */
export const TEXTBEE_SECRET_MIN_LENGTH = 20;

/**
 * Heuristika, NE činjenica iz dokumentacije: uređaj se smatra "vjerojatno online" ako je zadnji signal (lastHeartbeat)
 * mlađi od ovoga. Interval signala aplikacije nije potvrđen.
 */
export const TEXTBEE_ONLINE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Putovi API-ja (zaglavlje x-api-key). CONFIRMED u više stranica javne dokumentacije: GET /gateway/devices.
 *
 * Slanje: TRENUTNI put je POST /gateway/send-sms s neobaveznim `deviceId` u tijelu (bez njega TextBee uzima zadani ili zadnje
 * aktivni uređaj, pa ga uvijek šaljemo). Stariji put POST /gateway/devices/{id}/send-sms dokumentacija označava kao zastario
 * ("deprecated, još radi"); koristi se samo kao rezerva kad trenutni vrati 404 (pri 404 ništa nije poslano, pa nema dvostrukog slanja).
 * Tijelo: { recipients: [E.164], message } (CONFIRMED; stariji naziv polja "receivers" ne šaljemo).
 */
export const TEXTBEE_PATHS = {
  devices: "/gateway/devices",
  sendSms: "/gateway/send-sms",
  sendSmsLegacy: (deviceId: string) => `/gateway/devices/${encodeURIComponent(deviceId)}/send-sms`,
} as const;

/** Zaglavlje s API ključem (CONFIRMED). */
export const TEXTBEE_KEY_HEADER = "x-api-key";

/** Zaglavlje s potpisom webhooka: hex HMAC-SHA256 (CONFIRMED u većini izvora; vidi signedPayloadVariants). */
export const TEXTBEE_SIGNATURE_HEADER = "x-signature";

/**
 * Adresa API-ja: zadana je produkcijska. Zamjena (TEXTBEE_API_BASE) postoji samo za lažni poslužitelj u testovima, pa se
 * prihvaća samo https ili http prema localhostu; sve drugo se tiho ignorira da ključ slučajno ne ode na pogrešnu adresu.
 */
export function resolveTextbeeApiBase(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return TEXTBEE_DEFAULT_API_BASE;
  try {
    const u = new URL(value);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
    if (u.protocol === "https:" || (u.protocol === "http:" && local)) return value;
  } catch {
    /* neispravna adresa: koristi se zadana */
  }
  return TEXTBEE_DEFAULT_API_BASE;
}

/**
 * Oznaka u messages.from_number: "textbee:" + zadnja 4 znaka ID-a uređaja. Po prefiksu webhook zna da je odgovor stigao na
 * TextBee kanal (kanali se nikad ne miješaju s "twilio:" ni NOVO_SENDER); zadnja 4 znaka samo pomažu čovjeku pri čitanju.
 */
export function textbeeSenderMarker(deviceId: string | null | undefined): string {
  const tail = (deviceId ?? "").replace(/[^A-Za-z0-9]/g, "").slice(-4);
  return `${TEXTBEE_SENDER_PREFIX}${tail || "uredjaj"}`;
}

// --- Greške ---

/** Uklanja API ključ (i sve što izgleda kao TextBee ključ) iz teksta koji bi mogao završiti u poruci greške ili logu. */
export function scrubSecrets(text: string, secrets: Array<string | null | undefined> = []): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 4) out = out.split(s).join("***");
  }
  return out.replace(/txb_[A-Za-z0-9_-]{4,}/g, "***");
}

/** Poruka koju je poslao TextBee, očišćena (bez kontrolnih znakova i ključa) i ograničene duljine. */
export function cleanServerMessage(raw: unknown, secrets: Array<string | null | undefined> = []): string {
  const text = Array.isArray(raw) ? raw.filter((x) => typeof x === "string").join("; ") : typeof raw === "string" ? raw : "";
  return scrubSecrets(text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim(), secrets).slice(0, 160);
}

/**
 * Čitljiva hrvatska poruka za HTTP status koji vrati TextBee. `serverMessage` je već očišćen (cleanServerMessage) i dodaje se
 * samo kao dodatna informacija. Statusi: 401 CONFIRMED, 400 CONFIRMED ("no enabled device"), 429 CONFIRMED (savjet "pričekaj i ponovi"),
 * 403 i 404 UNCONFIRMED (404 za nepoznat uređaj je pretpostavka iz zadatka).
 */
export function describeTextbeeError(status: number | null, serverMessage = ""): string {
  const extra = serverMessage ? ` (${serverMessage})` : "";
  if (status === 401 || status === 403) {
    return `TextBee: pogrešan ili ugašen API ključ (TEXTBEE_API_KEY). U TextBee nadzornoj ploči napravite novi ključ i upišite ga u postavke servera.${extra}`;
  }
  if (status === 404) {
    return `TextBee: uređaj nije pronađen. Provjerite TEXTBEE_DEVICE_ID (gumb „Provjeri uređaje” pokazuje ispravan ID).${extra}`;
  }
  if (status === 400) {
    return `TextBee je odbio poruku. Najčešći razlog je isključen uređaj: u aplikaciji na mobitelu uključite Gateway, a provjerite i TEXTBEE_DEVICE_ID.${extra}`;
  }
  if (status === 429) return "TextBee: previše zahtjeva odjednom, pokušajte za nekoliko minuta.";
  if (status !== null && status >= 500) return `TextBee: poslužitelj trenutno ne radi (greška ${status}). Pokušajte ponovno za nekoliko minuta.`;
  return `TextBee: neočekivan odgovor${status !== null ? ` (greška ${status})` : ""}.${extra}`;
}

export const TEXTBEE_NETWORK_ERROR = "TextBee nije dostupan (greška mreže). Pokušajte ponovno.";
export const TEXTBEE_TIMEOUT_ERROR = "TextBee nije dostupan (istek vremena). Pokušajte ponovno.";

// --- Pomoćni čitači JSON-a ---

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);

/** Prvi niz znakova među zadanim ključevima. */
function pick(o: Obj | null | undefined, keys: string[]): string | null {
  if (!o) return null;
  for (const k of keys) {
    const v = str(o[k]);
    if (v) return v;
  }
  return null;
}

/** Tijelo odgovora: "data" omotač ili sam objekt. UNCONFIRMED koji je oblik stvaran, pa se čitaju oba. */
function unwrap(json: unknown): Obj | null {
  if (!isObj(json)) return null;
  return isObj(json.data) ? { ...json, ...json.data } : json;
}

/** Poruka greške iz tijela odgovora (NestJS: { message: string | string[], error, statusCode }; ili unutar "data"). */
export function errorMessageFromBody(json: unknown): unknown {
  if (!isObj(json)) return null;
  const inner = isObj(json.data) ? (json.data.message ?? json.data.error ?? null) : null;
  return json.message ?? json.error ?? inner;
}

// --- Odgovor na slanje ---

export type TextbeeSendParse = {
  /** ID za praćenje isporuke: smsBatchId, a ako njega nema ID poruke. null kad odgovor nema nikakav ID. */
  id: string | null;
  status: string | null;
  /** TextBee je u tijelu izričito javio neuspjeh (success: false) iako je HTTP status bio 2xx. */
  rejected: boolean;
};

/**
 * UNCONFIRMED oblik: { data: { success, message, smsBatchId, recipientCount } } (smsBatchId samo kad račun koristi red SMS-ova);
 * moguće i ID same poruke (_id / id / smsId). HTTP 2xx znači "prihvaćeno", ne "isporučeno".
 */
export function parseTextbeeSendResponse(json: unknown): TextbeeSendParse {
  const body = unwrap(json);
  const id = pick(body, ["smsBatchId", "batchId", "_id", "id", "smsId"]);
  const status = pick(body, ["status"]);
  return { id, status: status ? status.toLowerCase() : null, rejected: body?.success === false };
}

// --- Uređaji ---

export type TextbeeDevice = {
  id: string;
  name: string;
  model: string | null;
  brand: string | null;
  /** null = odgovor nema to polje. */
  enabled: boolean | null;
  lastHeartbeat: string | null;
  /** Heuristika (TEXTBEE_ONLINE_WINDOW_MS): zadnji signal je dovoljno svjež. null = nema podatka. */
  online: boolean | null;
};

/** UNCONFIRMED omotač: goli niz, { data: [...] }, { data: { devices } } ili { devices }. Polje _id je CONFIRMED. */
export function parseTextbeeDevices(json: unknown, now = Date.now()): TextbeeDevice[] {
  let list: unknown = null;
  if (Array.isArray(json)) list = json;
  else if (isObj(json)) {
    if (Array.isArray(json.data)) list = json.data;
    else if (isObj(json.data) && Array.isArray(json.data.devices)) list = json.data.devices;
    else if (Array.isArray(json.devices)) list = json.devices;
  }
  if (!Array.isArray(list)) return [];

  const out: TextbeeDevice[] = [];
  for (const raw of list) {
    if (!isObj(raw)) continue;
    const id = pick(raw, ["_id", "id", "deviceId"]);
    if (!id) continue;
    const brand = pick(raw, ["brand", "manufacturer"]);
    const model = pick(raw, ["model"]);
    const name = pick(raw, ["name", "deviceName"]) ?? [brand, model].filter(Boolean).join(" ");
    const heartbeat = pick(raw, ["lastHeartbeat", "lastHeartbeatAt"]);
    const hbTime = heartbeat ? Date.parse(heartbeat) : NaN;
    out.push({
      id,
      name: name || "Uređaj bez naziva",
      model,
      brand,
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : null,
      lastHeartbeat: heartbeat,
      online: Number.isFinite(hbTime) ? now - hbTime <= TEXTBEE_ONLINE_WINDOW_MS : null,
    });
  }
  return out;
}

// --- Webhook ---

export type TextbeeEventKind = "received" | "sent" | "delivered" | "failed" | "ignored";

/** Imena događaja. UNCONFIRMED aliasi: SMS_* (iz zadatka, ne nalaze se u izvorima), UNKNOWN_STATE se namjerno ignorira. */
const EVENT_KINDS: Record<string, TextbeeEventKind> = {
  MESSAGE_RECEIVED: "received",
  SMS_RECEIVED: "received",
  MESSAGE_SENT: "sent",
  SMS_SENT: "sent",
  MESSAGE_DELIVERED: "delivered",
  SMS_DELIVERED: "delivered",
  MESSAGE_FAILED: "failed",
  SMS_FAILED: "failed",
  UNKNOWN_STATE: "ignored",
};

export type TextbeeWebhookEvent = {
  kind: TextbeeEventKind;
  event: string;
  /** Jedinstven po obavijesti, isti pri ponovnom pokušaju (CONFIRMED): služi za otkrivanje duplikata. */
  idempotencyKey: string | null;
  smsId: string | null;
  smsBatchId: string | null;
  /** Pošiljatelj dolaznog SMS-a. */
  sender: string | null;
  /** Primatelj izlazne poruke (kod sent / delivered / failed). */
  recipient: string | null;
  message: string | null;
  receivedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

/**
 * Sadržaj webhooka. UNCONFIRMED oblik, vide se dva: ravni { smsId, message, deviceId, webhookEvent, idempotencyKey, sender,
 * receivedAt, smsBatchId, status, recipient, errorCode, errorMessage, ... } i ugniježđeni { event, timestamp, data: {...} }.
 * Vraća null kad nema imena događaja.
 */
export function parseTextbeeWebhook(json: unknown): TextbeeWebhookEvent | null {
  if (!isObj(json)) return null;
  const body: Obj = isObj(json.data) ? { ...json, ...json.data } : json;
  const event = pick(body, ["webhookEvent", "event", "type"]);
  if (!event) return null;
  const key = event.toUpperCase();
  return {
    kind: EVENT_KINDS[key] ?? "ignored",
    event: key,
    idempotencyKey: pick(body, ["idempotencyKey"]),
    smsId: pick(body, ["smsId", "messageId", "_id"]),
    smsBatchId: pick(body, ["smsBatchId", "batchId"]),
    sender: pick(body, ["sender", "from", "phoneNumber"]),
    recipient: pick(body, ["recipient", "to"]),
    message: typeof body.message === "string" ? body.message : null,
    receivedAt: pick(body, ["receivedAt"]),
    errorCode: pick(body, ["errorCode"]),
    errorMessage: pick(body, ["errorMessage"]),
  };
}

/**
 * Što TextBee potpisuje. CONFLICT u dokumentaciji: većina izvora kaže "sirovo tijelo zahtjeva", službeni primjer i jedan blog
 * koriste JSON.stringify(payload). Zato se provjeravaju oba (isti ključ, ista usporedba u konstantnom vremenu, pa ništa nije slabije):
 * sirovo tijelo, a ako se razlikuje, i kompaktni JSON istog sadržaja.
 */
export function signedPayloadVariants(rawBody: string): string[] {
  const variants = [rawBody];
  try {
    const compact = JSON.stringify(JSON.parse(rawBody));
    if (compact !== rawBody) variants.push(compact);
  } catch {
    /* nije JSON: samo sirovo tijelo */
  }
  return variants;
}
