/**
 * Čista logika oko Twilio postavki i grešaka (bez poziva prema mreži i bez server-only, da je
 * smiju koristiti env.ts, servisi i testovi). Ništa ovdje ne čita tajne: vrijednosti stižu kao argumenti.
 */

/** Prefiks u messages.from_number za poruke poslane preko Twilija (npr. "twilio:NOVO", "twilio:+12025550123"). */
export const TWILIO_SENDER_PREFIX = "twilio:";

export type TwilioSender =
  | { kind: "none" }
  | { kind: "number"; value: string }
  | { kind: "alpha"; value: string }
  | { kind: "invalid"; value: string; error: string };

const E164 = /^\+[1-9]\d{6,14}$/;
const ALPHA_CHARS = /^[A-Za-z0-9 ]+$/;
const MESSAGING_SERVICE = /^MG[0-9a-fA-F]{32}$/;
export const ALPHA_SENDER_MAX = 11;

/**
 * TWILIO_PHONE_NUMBER je ili broj u obliku E.164 (+385911234567) ili alfanumerička oznaka pošiljatelja
 * (najviše 11 znakova: slova bez kvačica, brojevi i razmak, barem jedno slovo, npr. "NOVO").
 */
export function parseTwilioSender(raw: string | null | undefined): TwilioSender {
  const value = (raw ?? "").trim();
  if (!value) return { kind: "none" };

  if (MESSAGING_SERVICE.test(value)) {
    return { kind: "invalid", value, error: "Ovo je Messaging Service SID. Upišite ga u TWILIO_MESSAGING_SERVICE_SID, a ne u TWILIO_PHONE_NUMBER." };
  }

  // Samo znamenke i znakovi telefonskog zapisa: tretira se kao broj.
  if (/^[+\d\s().-]+$/.test(value)) {
    let digits = value.replace(/[\s().-]/g, "");
    if (digits.startsWith("00")) digits = "+" + digits.slice(2);
    if (E164.test(digits)) return { kind: "number", value: digits };
    return {
      kind: "invalid",
      value,
      error: digits.startsWith("+")
        ? `Broj "${value}" nije ispravan. Upišite ga u međunarodnom obliku, npr. +12025550123.`
        : `"${value}" nije ispravan broj ni oznaka pošiljatelja. Broj mora počinjati s + (npr. +12025550123), a oznaka mora imati barem jedno slovo (npr. NOVO).`,
    };
  }

  if (!ALPHA_CHARS.test(value)) {
    return {
      kind: "invalid",
      value,
      error: `Oznaka pošiljatelja "${value}" smije imati samo slova bez kvačica, brojeve i razmak. Za broj koristite oblik +12025550123.`,
    };
  }
  if (value.length > ALPHA_SENDER_MAX) {
    return {
      kind: "invalid",
      value,
      error: `Oznaka pošiljatelja smije imati najviše ${ALPHA_SENDER_MAX} znakova, a "${value}" ih ima ${value.length}.`,
    };
  }
  if (!/[A-Za-z]/.test(value)) {
    return { kind: "invalid", value, error: "Oznaka pošiljatelja mora sadržavati barem jedno slovo." };
  }
  return { kind: "alpha", value };
}

export type MessagingServiceParse = { kind: "none" } | { kind: "valid"; value: string } | { kind: "invalid"; value: string; error: string };

export function parseMessagingServiceSid(raw: string | null | undefined): MessagingServiceParse {
  const value = (raw ?? "").trim();
  if (!value) return { kind: "none" };
  if (MESSAGING_SERVICE.test(value)) return { kind: "valid", value };
  return { kind: "invalid", value, error: "TWILIO_MESSAGING_SERVICE_SID nije ispravan (treba počinjati s MG i imati 34 znaka)." };
}

export type ResolvedTwilioSender =
  | { mode: "messaging_service"; value: string }
  | { mode: "from"; sender: Extract<TwilioSender, { kind: "number" | "alpha" }> }
  | { mode: "none" }
  | { mode: "invalid"; error: string };

/** Što se stvarno šalje kao pošiljatelj: Messaging Service ima prednost, inače TWILIO_PHONE_NUMBER. */
export function resolveTwilioSender(from: string | null | undefined, messagingServiceSid: string | null | undefined): ResolvedTwilioSender {
  const ms = parseMessagingServiceSid(messagingServiceSid);
  if (ms.kind === "invalid") return { mode: "invalid", error: ms.error };
  if (ms.kind === "valid") return { mode: "messaging_service", value: ms.value };
  const sender = parseTwilioSender(from);
  if (sender.kind === "invalid") return { mode: "invalid", error: sender.error };
  if (sender.kind === "none") return { mode: "none" };
  return { mode: "from", sender };
}

/** Čitljiv naziv pošiljatelja za sučelje. */
export function senderLabel(r: ResolvedTwilioSender): string | null {
  if (r.mode === "messaging_service") return `Messaging Service (${r.value.slice(0, 6)}…)`;
  if (r.mode === "from") return r.sender.kind === "alpha" ? `${r.sender.value} (oznaka pošiljatelja, bez broja)` : r.sender.value;
  return null;
}

/**
 * Javna https adresa: Twilio ne može dojaviti status isporuke na localhost, običan http ili
 * privatnu mrežu. Vraća razlog kad adresa nije upotrebljiva, inače null.
 */
export function publicHttpsProblem(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "adresa nije valjana";
  }
  if (u.protocol !== "https:") return "adresa nije https";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return "adresa nije javna (localhost)";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) {
      return "adresa nije javna (privatna IP adresa)";
    }
  }
  if (host.includes(":") || !host.includes(".")) return "adresa nije javna domena";
  return null;
}

export const isPublicHttpsUrl = (url: string) => publicHttpsProblem(url) === null;

// --- Greške ---

/**
 * Hrvatske upute za česte Twilio kodove (REST greške pri slanju 2xxxx i kodovi isporuke 3xxxx).
 * Kodove vraća Twilio; tekst je naš.
 */
const HINTS: Record<number, string> = {
  20003: "Pogrešan TWILIO_ACCOUNT_SID ili TWILIO_AUTH_TOKEN. Provjerite ih u Twilio konzoli.",
  20404: "Twilio ne nalazi račun ili poruku. Provjerite TWILIO_ACCOUNT_SID.",
  21211: "Broj primatelja nije ispravan. Upišite ga u obliku +385 91 234 5678.",
  21212: "Pošiljatelj (TWILIO_PHONE_NUMBER) nije ispravan. Broj mora biti u obliku +12025550123, a oznaka najviše 11 znakova.",
  21408:
    "Twilio nema dopuštenje za slanje u tu državu. U Twilio konzoli otvorite Messaging → Settings → Geo permissions i uključite Croatia (Hrvatska).",
  21606: "Pošiljatelj nije broj iz vašeg Twilio računa koji može slati SMS. Provjerite TWILIO_PHONE_NUMBER.",
  21608: "Probni Twilio račun šalje samo na potvrđene brojeve (Verified Caller IDs). Potvrdite broj primatelja ili nadogradite račun.",
  21610: "Primatelj je u Twilioju blokirao poruke (odjava). Takvom broju se ne može slati.",
  21611: "Pošiljatelj (Messaging Service) nema slobodnih kapaciteta ili brojeva za slanje.",
  21612:
    "Taj pošiljatelj ne smije slati na taj broj. Za Hrvatsku provjerite: je li Hrvatska uključena u Geo permissions, je li oznaka pošiljatelja dopuštena za Hrvatsku (možda treba registracija oznake pošiljatelja u Twilio konzoli) i može li taj tip pošiljatelja slati u Hrvatsku.",
  21614: "Broj primatelja nije valjan mobilni broj (ili Twilio ne može poslati SMS na njega).",
  21617: "Poruka je preduga (najviše 1600 znakova).",
  21618: "Tekst poruke je prazan.",
  21703: "Messaging Service nema pošiljatelja. Dodajte broj ili oznaku pošiljatelja u servis.",
  21704: "Messaging Service nije pronađen. Provjerite TWILIO_MESSAGING_SERVICE_SID.",
  21705: "Messaging Service nije ispravan ili je ugašen.",
  30003: "Mobitel primatelja je nedostupan (isključen ili izvan dosega).",
  30004: "Primatelj ili operater blokira poruke.",
  30005: "Nepoznat broj primatelja ili broj više ne postoji.",
  30006: "Broj je fiksni ili ne prima SMS.",
  30007: "Operater je filtrirao poruku. Za oznaku pošiljatelja provjerite treba li je registrirati u Twilio konzoli.",
  30008: "Twilio nije dobio konačan odgovor operatera. Poruka je možda isporučena.",
};

export type TwilioErrorInput = { code?: number | string | null; message?: string | null; status?: number | null };

/** "Twilio: <poruka> (<kod>). <upute>" — poruka Twilija ostaje vidljiva, uz hrvatsku uputu kad je znamo. */
export function describeTwilioError(e: TwilioErrorInput): string {
  const code = e.code == null || e.code === "" ? undefined : Number(e.code);
  const hint = code != null && Number.isFinite(code) ? HINTS[code] : undefined;
  const message = (e.message || "").trim().slice(0, 240);
  const base = message ? `Twilio: ${message}${code ? ` (${code})` : ""}` : `Twilio greška${e.status ? ` (HTTP ${e.status})` : ""}${code ? ` (${code})` : ""}`;
  return hint ? `${base}. ${hint}` : base;
}

export function twilioHint(code: number | string | null | undefined): string | null {
  if (code == null || code === "") return null;
  const n = Number(code);
  return Number.isFinite(n) ? (HINTS[n] ?? null) : null;
}
