/*
 * Čiste funkcije za statistiku stolova jelovnika: čišćenje oznake stola (nepouzdan unos iz ?stol=), hrvatska množina i
 * rečenice za tjedni izvještaj. Bez baze i bez server-only: koriste ih poslužitelj, sučelje operatera i testovi.
 */

export const NO_TABLE_LABEL = "bez stola";
/** Najviše znakova oznake stola u statistici (dulje se reže). */
export const TABLE_LABEL_MAX = 12;

/**
 * Oznaka stola iz sirovog unosa (nr_menu_guests.table_label, koji dolazi iz ?stol= i nije pouzdan): bez dijakritika,
 * velika slova, samo A-Z 0-9 razmak i crtica (točka, podvlaka i kosa crta postaju crtica, sve ostalo otpada), najviše 12 znakova,
 * bez vodećih nula u brojevima. Prazno nakon čišćenja = null (u statistici "bez stola"). Rezultat se u sučelju uvijek ispisuje kao
 * običan tekst (React ga escapea), a ovdje je dodatno sveden na sigurni skup znakova.
 */
export function normalizeTableLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let t = raw
    .slice(0, 200)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[._/\\]+/g, "-")
    .replace(/[^A-Z0-9 -]/g, "");
  t = t
    .replace(/\s*-\s*/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s-]+|[\s-]+$/g, "");
  t = t.replace(/^0+(?=\d)/, "").slice(0, TABLE_LABEL_MAX).replace(/[\s-]+$/g, "");
  return t || null;
}

export const WEEKDAYS_SHORT = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"] as const;
export const WEEKDAYS_LONG = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"] as const;

/** Hrvatski množinski oblici: 1 / 2 do 4 / 5 i više (i 11 do 14). */
export function pluralHr(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const nf = (n: number) => n.toLocaleString("hr-HR");

/** "12 gostiju ostavilo broj", "1 gost ostavio broj", "3 gosta ostavila broj". */
export function guestsLeftNumber(n: number): string {
  return `${nf(n)} ${pluralHr(n, "gost ostavio", "gosta ostavila", "gostiju ostavilo")} broj`;
}

/** "1 nova recenzija", "2 nove recenzije", "5 novih recenzija". */
export function newReviewsPhrase(n: number): string {
  return `${nf(n)} ${pluralHr(n, "nova recenzija", "nove recenzije", "novih recenzija")}`;
}

export type VenueWeekly = {
  /** Gosti koji su ostavili broj u razdoblju (unosi na vratima jelovnika). */
  guests: number;
  /** Skupljanje brojeva je uključeno (inače rečenica o gostima nema smisla). */
  captureEnabled: boolean;
  /** Najposjećeniji stol (bez "bez stola") ili null. */
  topTable: { label: string; count: number } | null;
  /** Sat u danu (0 do 23) s najviše unosa ili null. */
  peakHour: number | null;
};

/** Jedna rečenica na vrhu izvještaja za ugostitelje: "Ovaj tjedan: 12 gostiju ostavilo broj, 3 nove recenzije, prosječna ocjena 4,7." */
export function venueSummaryLine(v: Pick<VenueWeekly, "guests" | "captureEnabled">, newReviews: number, averageRating: number | null): string {
  const parts: string[] = [];
  if (v.captureEnabled) parts.push(guestsLeftNumber(v.guests));
  parts.push(newReviewsPhrase(newReviews));
  if (newReviews > 0 && averageRating != null) parts.push(`prosječna ocjena ${averageRating.toFixed(1).replace(".", ",")}`);
  return `Ovaj tjedan: ${parts.join(", ")}.`;
}

/** "Najposjećeniji stol ovaj tjedan: 12 (9 gostiju ostavilo broj). Najviše gostiju u 20 h." ili null kad nema podataka. */
export function venueTableSentence(v: VenueWeekly): string | null {
  if (!v.captureEnabled || v.guests <= 0) return null;
  const parts: string[] = [];
  if (v.topTable) parts.push(`Najposjećeniji stol ovaj tjedan: ${v.topTable.label} (${guestsLeftNumber(v.topTable.count)}).`);
  if (v.peakHour !== null) parts.push(`Najviše gostiju u ${v.peakHour} h.`);
  return parts.length ? parts.join(" ") : null;
}
