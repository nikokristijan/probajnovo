/**
 * Vrsta poslovanja klijenta u NOVO adminu (/admin/recenzije) i dopuštena odredišta "Otvori radni prostor".
 * Čisto (bez baze i bez server-only): koriste ga i server radnje i forme u pregledniku, pa tekstovi ne mogu
 * razjahati. Server radnje ionako sve provjeravaju ponovno (zod).
 */

export const BUSINESS_TYPES = [
  { value: "service", label: "Usluga / obrt" },
  { value: "venue", label: "Ugostiteljstvo (kafić, restoran, konoba...)" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export const BUSINESS_TYPE_VALUES = ["service", "venue"] as const satisfies readonly BusinessType[];

/** Što upisujemo u "Djelatnost" kad NOVO tim odabere ugostiteljstvo, a polje ostavi prazno. */
export const DEFAULT_VENUE_INDUSTRY = "Ugostiteljstvo";

export function businessTypeOf(isVenue: boolean): BusinessType {
  return isVenue ? "venue" : "service";
}

/**
 * Djelatnost za spremanje: ono što je tim upisao, a za ugostiteljstvo bez upisa zadana vrijednost.
 * Prazno za uslugu ostaje prazno (null), kao i prije.
 */
export function industryFor(industry: string, businessType: BusinessType): string | null {
  const own = industry.trim();
  if (own) return own;
  return businessType === "venue" ? DEFAULT_VENUE_INDUSTRY : null;
}

/**
 * Odredišta na koja "Otvori radni prostor" smije odvesti: FIKSNA lista internih putanja. Sve ostalo se odbija
 * (nikad se ne preusmjerava na proizvoljan unos), pa forma ne može poslužiti kao otvoreno preusmjeravanje.
 */
export const WORKSPACE_TARGETS = ["/recenzije/pregled", "/recenzije/jelovnik"] as const;

export type WorkspaceTarget = (typeof WORKSPACE_TARGETS)[number];

export const DEFAULT_WORKSPACE_TARGET: WorkspaceTarget = "/recenzije/pregled";

/** Prazno ili izostavljeno = zadano odredište; nepoznata vrijednost = null (pozivatelj odbija zahtjev). */
export function workspaceTargetFor(raw: string | null | undefined): WorkspaceTarget | null {
  const v = (raw ?? "").trim();
  if (v === "") return DEFAULT_WORKSPACE_TARGET;
  return (WORKSPACE_TARGETS as readonly string[]).includes(v) ? (v as WorkspaceTarget) : null;
}
