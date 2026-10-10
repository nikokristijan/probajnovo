/**
 * Tekst privole koji gost vidi uz polje za broj mobitela na vratima jelovnika (/jelovnik/<slug>), na jednom mjestu.
 * Isti tekst prikazuje stranica i sprema poslužitelj uz svaki unos kao dokaz privole (nr_menu_guests.consent_text),
 * a `GUEST_CONSENT_VERSION` se POVEĆA svaki put kad se značenje teksta promijeni (ne zbog tipfelera), da se zna
 * koju je verziju koji gost prihvatio. Čisto (bez baze i bez server-only): smiju ga koristiti i komponente u pregledniku.
 *
 * Dvije varijante teksta (obje nose istu verziju, a spremljeni cijeli tekst kaže koja je prikazana): zadana, gdje gost pristaje
 * na JEDNU poruku s molbom za recenziju, i ona kad lokal uključi "obavijesti" (nr_menus.notices_enabled), gdje gost pristaje
 * i na povremene obavijesti o novostima, događanjima i ponudama lokala.
 */
import { menuNoun, type MenuKind } from "./menu-noun";

export const GUEST_CONSENT_VERSION = "2026-10-3";

/** Koliko se dugo čuva broj gosta s jelovnika (mjeseci). Tekst privole i purgeOldGuestData koriste istu brojku. */
export const GUEST_RETENTION_MONTHS = 12;

/** Dopušteno trajanje odgode do poruke (minute), isto kao CHECK u bazi (nr_menus_delay_range). */
export const MENU_DELAY_MIN = 60;
export const MENU_DELAY_MAX = 240;
export const MENU_DELAY_DEFAULT = 90;

/** Najviše 60, najviše 240 minuta; sve izvan toga vraća zadano. */
export function clampDelayMinutes(minutes: number | null | undefined): number {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return MENU_DELAY_DEFAULT;
  return Math.min(MENU_DELAY_MAX, Math.max(MENU_DELAY_MIN, Math.round(minutes)));
}

const HOURS_ACC: Record<number, string> = { 1: "sat", 2: "dva sata", 3: "tri sata", 4: "četiri sata" };

/**
 * Odgoda riječima, za tekst privole: 60 -> "sat vremena", 90 -> "sat i pol", 120 -> "dva sata", 150 -> "dva i pol sata",
 * 240 -> "četiri sata". Vrijednosti koje nisu na pola sata zaokružuju se na najbližih 5 minuta ("75 minuta").
 */
export function delayWording(minutes: number): string {
  const m = clampDelayMinutes(minutes);
  if (m === 60) return "sat vremena";
  if (m === 90) return "sat i pol";
  if (m === 150) return "dva i pol sata";
  if (m === 210) return "tri i pol sata";
  if (m % 60 === 0) return HOURS_ACC[m / 60] ?? `${m} minuta`;
  return `${Math.round(m / 5) * 5} minuta`;
}

/** Postavke lokala koje određuju tekst privole. Sve je neobavezno: bez njih vrijedi zadana varijanta (jedna molba za recenziju). */
export type ConsentOptions = {
  /** Lokal šalje i povremene obavijesti (nr_menus.notices_enabled). */
  noticesEnabled?: boolean;
  /** "jelovnik" ili "meni" (nr_menus.menu_kind). */
  menuKind?: MenuKind | null;
  /** Gost može otvoriti stranicu i bez broja (nr_menus.allow_skip); tek tada se to smije reći u tekstu. */
  allowSkip?: boolean;
};

const venueLabel = (venueName: string) => venueName.trim() || "lokal";

/**
 * Privola je u dva sloja: kratka rečenica uz kvačicu (tko šalje i što) i "Pročitaj više" s ostalim pojedinostima
 * (kada, noćna pauza, rok čuvanja, odjava). Gost vidi oba sloja, a poslužitelj uz unos sprema OBA zajedno (`guestConsentText`),
 * pa dokaz privole sadrži cijeli tekst. Pristaje se na konkretnu poruku, ne na politiku privatnosti (ona samo informira).
 * Stranica i poslužitelj zovu ISTE funkcije s istim postavkama lokala, pa spremljeni tekst jest ono što je gost vidio.
 */
export function guestConsentSummary(venueName: string, delayMinutes: number, opts: ConsentOptions = {}): string {
  const name = venueLabel(venueName);
  if (opts.noticesEnabled) {
    return `Pristajem da mi ${name} povremeno šalje SMS obavijesti o novostima, događanjima i ponudama.`;
  }
  return `Pristajem da mi ${name} preko NOVO Recenzija jednom pošalje SMS s molbom za Google recenziju otprilike ${delayWording(delayMinutes)} nakon posjeta.`;
}

export function guestConsentDetails(delayMinutes: number = MENU_DELAY_DEFAULT, opts: ConsentOptions = {}): string {
  if (opts.noticesEnabled) {
    const noun = menuNoun(opts.menuKind);
    return (
      `Prva poruka je molba za Google recenziju otprilike ${delayWording(delayMinutes)} nakon posjeta. ` +
      `Kasnije poruke mogu biti obavijesti o novostima, događanjima i ponudama ovog lokala. ` +
      `Noću (od 22:00 do 09:00) se poruke ne šalju. ` +
      `Broj se čuva najviše ${GUEST_RETENTION_MONTHS} mjeseci i koristi se samo za poruke ovog lokala opisane gore, preko NOVO Recenzija. ` +
      `Odjava u svakoj poruci: odgovor STOP ili poveznica.` +
      (opts.allowSkip ? ` ${noun.Nom} možete otvoriti i bez broja.` : "")
    );
  }
  return (
    `Noću se poruke ne šalju, pa može stići idućeg jutra. ` +
    `Broj se čuva najviše ${GUEST_RETENTION_MONTHS} mjeseci i ne koristi se ni za što drugo. ` +
    `Odjava: odgovor STOP ili poveznica u poruci.`
  );
}

/** Cijeli tekst privole kakav se sprema kao dokaz (oba sloja). */
export function guestConsentText(venueName: string, delayMinutes: number, opts: ConsentOptions = {}): string {
  return `${guestConsentSummary(venueName, delayMinutes, opts)} ${guestConsentDetails(delayMinutes, opts)}`;
}

/** Jedna kratka rečenica iznad polja za broj na vratima (ne zamjenjuje privolu). */
export function guestGateLine(menuKind?: MenuKind | null): string {
  return `${menuNoun(menuKind).Nom} otvarate unosom broja mobitela.`;
}
