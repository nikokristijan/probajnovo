/**
 * Pravila slanja gostima s jelovnika (klijenti s izvorom "menu"), na jednom mjestu za poslužitelj i za sučelje.
 * Čisto (bez baze i bez server-only).
 *
 * Gost koji je samo upisao broj pristao je na JEDNU automatsku poruku s molbom za recenziju. Ako je lokal imao uključene
 * obavijesti i gost je vidio tu varijantu privole (nr_menu_guests.notices_consent), smiju mu stizati i ručne poruke,
 * podsjetnici, kampanje i skupna slanja. Klijent kojem je tim zabilježio uslugu je običan klijent. Noću (22:00 do 09:00)
 * se gostu s jelovnika ne šalje ništa osim automatskog zahtjeva za recenziju, koji ima vlastitu noćnu pauzu.
 */

export const NO_CONSENT_ERROR = "Gost s jelovnika pristao je samo na jednu poruku s molbom za recenziju, pa mu se druge poruke ne šalju.";
export const QUIET_HOURS_ERROR = "Gostu s jelovnika poruke se ne šalju između 22:00 i 09:00. Pokušajte ponovno nakon 09:00.";

/** Oznaka klijenta u sučelju. */
export const MENU_GUEST_LABEL = "Gost s jelovnika";

/** Smije li se gostu s jelovnika poslati poruka koja nije automatski zahtjev za recenziju (ostali klijenti: uvijek da). */
export function mayMessageClient(c: { source?: string | null; hasService: boolean; noticesConsent: boolean }): boolean {
  return c.source !== "menu" || c.hasService || c.noticesConsent;
}

/** Je li ovo automatski zahtjev za recenziju (jedina poruka na koju pristaje svaki gost s jelovnika). */
export function isAutomatedReviewRequest(input: { kind: string; automationRunId?: string | null }): boolean {
  return input.kind === "REVIEW_REQUEST" && Boolean(input.automationRunId);
}

/** Kratka oznaka za sučelje: "Gost s jelovnika · obavijesti: da/ne". */
export function menuGuestBadge(noticesConsent: boolean): string {
  return `${MENU_GUEST_LABEL} · obavijesti: ${noticesConsent ? "da" : "ne"}`;
}

/** Šifre odbijanja koje se u skupnim slanjima broje kao "preskočeno", a ne kao greška. */
export function isSkippedSend(code: string): boolean {
  return code === "NO_CONSENT" || code === "QUIET_HOURS";
}

/** Dodatak poruci o ishodu skupnog slanja: "Preskočeno: 2 (gosti s jelovnika bez privole za obavijesti ili noćna pauza)." */
export function skippedNote(skipped: number): string {
  return skipped > 0 ? ` Preskočeno: ${skipped} (gosti s jelovnika bez privole za obavijesti ili noćna pauza od 22:00 do 09:00).` : "";
}
