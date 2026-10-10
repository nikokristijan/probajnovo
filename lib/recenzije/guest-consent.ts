/**
 * Tekst privole koji gost vidi uz polje za broj mobitela na vratima jelovnika (/jelovnik/<slug>), na jednom mjestu.
 * Isti tekst prikazuje stranica i sprema poslužitelj uz svaki unos kao dokaz privole (nr_menu_guests.consent_text),
 * a `GUEST_CONSENT_VERSION` se POVEĆA svaki put kad se značenje teksta promijeni (ne zbog tipfelera), da se zna
 * koju je verziju koji gost prihvatio. Čisto (bez baze i bez server-only): smiju ga koristiti i komponente u pregledniku.
 */
export const GUEST_CONSENT_VERSION = "2026-10-1";

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

/**
 * Tekst privole za lokal. Obuhvaća: tko šalje (lokal preko NOVO Recenzija), što (jedan SMS s molbom za Google recenziju),
 * kada (otprilike N nakon posjeta; noću se ne šalje), koliko se čuva broj i da se ne koristi ni za što drugo te kako se odjaviti.
 */
export function guestConsentText(venueName: string, delayMinutes: number): string {
  const name = venueName.trim() || "lokal";
  return (
    `Unosom broja pristajem da mi ${name} preko NOVO Recenzija jednom pošalje SMS s molbom za Google recenziju ` +
    `otprilike ${delayWording(delayMinutes)} nakon posjeta (noću se poruke ne šalju, pa može stići idućeg jutra). ` +
    `Broj se čuva najviše ${GUEST_RETENTION_MONTHS} mjeseci i ne koristi se ni za što drugo. ` +
    `Odjava: odgovor STOP ili poveznica u poruci.`
  );
}

/** Kratko objašnjenje iznad polja za broj (ne zamjenjuje privolu). */
export function guestGateExplanation(venueName: string): string {
  const name = venueName.trim() || "lokal";
  return `Upišite broj mobitela da otvorite jelovnik. ${name} će vam nakon posjeta poslati jednu kratku poruku s molbom za recenziju.`;
}
