import { and, eq, inArray, sql } from "drizzle-orm";
import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { db } from "./index";

/**
 * Smještajne jedinice (npr. "Duka & Piko Apartments 1" i "… 2") unutar JEDNE
 * vikendice — svaka dobiva vlastitu podstranicu (/[slug]/[unit]), vlastite
 * karakteristike i vlastiti kalendar dostupnosti (ručni unos + vlastiti iCal
 * link s Booking.com/Airbnb oglasa TOG apartmana).
 *
 * Namjerno u ZASEBNIM tablicama (property_extras, property_unit_blocked_dates)
 * umjesto novih stupaca na properties/property_blocked_dates: nijedan
 * postojeći upit (rezervacije, zarada, vlasnički dashboard…) ne mijenja se,
 * a vikendice bez jedinica rade točno kao i prije. Tablice se stvaraju same
 * (CREATE TABLE IF NOT EXISTS), isti obrazac kao ensure*Table u queries.ts.
 *
 * Dani blokirani za CIJELI objekt (stari property_blocked_dates: rezervacije,
 * ručni unos, iCal cijelog objekta) i dalje vrijede za SVE jedinice — vidi
 * mergeUnitBlocked ispod.
 */

export type PropertyUnit = {
  /** URL dio podstranice, npr. "apartman-1" → /dukaandpiko/apartman-1. */
  slug: string;
  /** Puni naziv — isti kao naziv ispred zagrade u sezonskom cjeniku i kao
      kategorija slika u galeriji (tako se povezuju cijene i fotografije). */
  name: string;
  sizeM2: number | null;
  guests: number | null;
  bedrooms: number | null;
  /** Slobodan tekst (npr. "1,5"), jer "pola kupaonice" nije cijeli broj. */
  bathrooms: string;
  description: string;
  descriptionEn: string;
  features: string[];
  featuresEn: string[];
  /** iCal export link s Booking.com/Airbnb oglasa OVOG apartmana. */
  icalUrl: string;
};

export type DestinationHighlight = { title: string; titleEn: string; text: string; textEn: string };
export type PropertyDestination = {
  title: string;
  titleEn: string;
  intro: string;
  introEn: string;
  highlights: DestinationHighlight[];
};
export type PropertyExtras = { units: PropertyUnit[]; destination: PropertyDestination | null };

export const propertyExtras = pgTable("property_extras", {
  propertyId: integer("property_id").primaryKey(),
  units: jsonb("units").$type<PropertyUnit[]>().notNull().default([]),
  destination: jsonb("destination").$type<PropertyDestination | null>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertyUnitBlockedDates = pgTable("property_unit_blocked_dates", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  unitSlug: text("unit_slug").notNull(),
  /** "YYYY-MM-DD", isti format kao property_blocked_dates.date. */
  date: text("date").notNull(),
  /** "manual" | "ical" */
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

let unitTablesPromise: Promise<void> | null = null;
function ensureUnitTables(): Promise<void> {
  if (!unitTablesPromise) {
    unitTablesPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS property_extras (
          property_id INTEGER PRIMARY KEY,
          units JSONB NOT NULL DEFAULT '[]'::jsonb,
          destination JSONB,
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS property_unit_blocked_dates (
          id SERIAL PRIMARY KEY,
          property_id INTEGER NOT NULL,
          unit_slug TEXT NOT NULL,
          date TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS property_unit_blocked_dates_prop_idx
        ON property_unit_blocked_dates (property_id, unit_slug)
      `);
    })().catch((err) => {
      unitTablesPromise = null;
      throw err;
    });
  }
  return unitTablesPromise;
}

/* ------------------------------------------------------------------ */
/* Normalizacija (JSON iz baze ili iz admin forme nikad ne vjerujemo    */
/* na riječ — svako polje svedemo na očekivani tip).                    */
/* ------------------------------------------------------------------ */

function str(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function int(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
function lines(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return arr.map((x) => str(x, 200)).filter(Boolean).slice(0, 60);
}

export function slugifyUnit(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/&/g, " i ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function normalizeUnits(raw: unknown): PropertyUnit[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PropertyUnit[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = str(r.name, 120);
    if (!name) continue;
    let slug = slugifyUnit(str(r.slug, 80) || name);
    if (!slug) continue;
    // "en" je rezerviran za englesku inačicu na poddomeni (/en/…).
    if (slug === "en") slug = "en-1";
    while (seen.has(slug)) slug = `${slug}-2`;
    seen.add(slug);
    const ical = str(r.icalUrl, 1000);
    out.push({
      slug,
      name,
      sizeM2: int(r.sizeM2),
      guests: int(r.guests),
      bedrooms: int(r.bedrooms),
      bathrooms: str(r.bathrooms, 20),
      description: str(r.description),
      descriptionEn: str(r.descriptionEn),
      features: lines(r.features),
      featuresEn: lines(r.featuresEn),
      icalUrl: /^https?:\/\//i.test(ical) ? ical : "",
    });
  }
  return out;
}

export function normalizeDestination(raw: unknown): PropertyDestination | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const highlights: DestinationHighlight[] = (Array.isArray(r.highlights) ? r.highlights : [])
    .slice(0, 12)
    .map((h) => {
      const x = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
      return { title: str(x.title, 120), titleEn: str(x.titleEn, 120), text: str(x.text, 1200), textEn: str(x.textEn, 1200) };
    })
    .filter((h) => h.title || h.text);
  const d: PropertyDestination = {
    title: str(r.title, 120),
    titleEn: str(r.titleEn, 120),
    intro: str(r.intro),
    introEn: str(r.introEn),
    highlights,
  };
  return d.intro || d.highlights.length > 0 || d.title ? d : null;
}

/* ------------------------------------------------------------------ */
/* Čitanje / spremanje                                                  */
/* ------------------------------------------------------------------ */

export async function getPropertyExtras(propertyId: number): Promise<PropertyExtras> {
  await ensureUnitTables();
  const rows = await db.select().from(propertyExtras).where(eq(propertyExtras.propertyId, propertyId)).limit(1);
  const row = rows[0];
  if (!row) return { units: [], destination: null };
  return { units: normalizeUnits(row.units), destination: normalizeDestination(row.destination) };
}

/** Best-effort inačica za javne stranice — greška baze nikad ne smije srušiti stranicu gostu. */
export async function getPropertyExtrasSafe(propertyId: number): Promise<PropertyExtras> {
  try {
    return await getPropertyExtras(propertyId);
  } catch (err) {
    console.error("[getPropertyExtrasSafe] nije uspio:", err);
    return { units: [], destination: null };
  }
}

export async function savePropertyExtras(
  propertyId: number,
  units: PropertyUnit[],
  destination: PropertyDestination | null
) {
  await ensureUnitTables();
  await db
    .insert(propertyExtras)
    .values({ propertyId, units, destination, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: propertyExtras.propertyId,
      set: { units, destination, updatedAt: new Date() },
    });
}

export type UnitBlockedRow = { unitSlug: string; date: string; source: string };

export async function listUnitBlockedDates(propertyId: number): Promise<UnitBlockedRow[]> {
  await ensureUnitTables();
  return db
    .select({
      unitSlug: propertyUnitBlockedDates.unitSlug,
      date: propertyUnitBlockedDates.date,
      source: propertyUnitBlockedDates.source,
    })
    .from(propertyUnitBlockedDates)
    .where(eq(propertyUnitBlockedDates.propertyId, propertyId));
}

/**
 * Zauzeti dani JEDNE jedinice = njezini vlastiti dani + dani blokirani za
 * cijeli objekt (rezervacije, ručno, iCal cijelog objekta). Vlastiti redak
 * ima prednost (zadržava svoj izvor), objektni se dodaju samo ako taj dan
 * jedinica već nema.
 */
export function mergeUnitBlocked(
  unitSlug: string,
  unitRows: UnitBlockedRow[],
  propertyRows: { date: string; source: string }[]
): { date: string; source: string; scope: "unit" | "property" }[] {
  const own = unitRows
    .filter((r) => r.unitSlug === unitSlug)
    .map((r) => ({ date: r.date, source: r.source, scope: "unit" as const }));
  const seen = new Set(own.map((r) => r.date));
  const shared = propertyRows
    .filter((r) => !seen.has(r.date))
    .map((r) => ({ date: r.date, source: r.source, scope: "property" as const }));
  return [...own, ...shared];
}

export async function toggleUnitBlockedDate(
  propertyId: number,
  unitSlug: string,
  date: string,
  currentlyBlocked: boolean
) {
  await ensureUnitTables();
  if (currentlyBlocked) {
    await db
      .delete(propertyUnitBlockedDates)
      .where(
        and(
          eq(propertyUnitBlockedDates.propertyId, propertyId),
          eq(propertyUnitBlockedDates.unitSlug, unitSlug),
          eq(propertyUnitBlockedDates.date, date),
          eq(propertyUnitBlockedDates.source, "manual")
        )
      );
    return;
  }
  await addManualUnitBlockedDate(propertyId, unitSlug, date);
}

async function addManualUnitBlockedDate(propertyId: number, unitSlug: string, date: string) {
  const existing = await db
    .select({ id: propertyUnitBlockedDates.id })
    .from(propertyUnitBlockedDates)
    .where(
      and(
        eq(propertyUnitBlockedDates.propertyId, propertyId),
        eq(propertyUnitBlockedDates.unitSlug, unitSlug),
        eq(propertyUnitBlockedDates.date, date)
      )
    )
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(propertyUnitBlockedDates).values({ propertyId, unitSlug, date, source: "manual" });
}

function datesInRangeInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let guard = 0;
  while (cur.getTime() <= last.getTime() && guard < 800) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return out;
}

export async function blockUnitDateRange(propertyId: number, unitSlug: string, start: string, end: string) {
  await ensureUnitTables();
  const dates = datesInRangeInclusive(start, end);
  for (const date of dates) {
    await addManualUnitBlockedDate(propertyId, unitSlug, date);
  }
  return dates.length;
}

/** iCal sync jedne jedinice: obriše njezine stare "ical" retke i upiše nove. */
export async function replaceUnitIcalBlockedDates(propertyId: number, unitSlug: string, dates: string[]) {
  await ensureUnitTables();
  await db
    .delete(propertyUnitBlockedDates)
    .where(
      and(
        eq(propertyUnitBlockedDates.propertyId, propertyId),
        eq(propertyUnitBlockedDates.unitSlug, unitSlug),
        eq(propertyUnitBlockedDates.source, "ical")
      )
    );
  if (dates.length === 0) return;
  await db
    .insert(propertyUnitBlockedDates)
    .values(dates.map((date) => ({ propertyId, unitSlug, date, source: "ical" })));
}

/** Sve jedinice s postavljenim iCal linkom — za cron app/api/cron/sync-ical. */
export async function listUnitIcalFeeds(): Promise<{ propertyId: number; unitSlug: string; icalUrl: string }[]> {
  await ensureUnitTables();
  const rows = await db.select().from(propertyExtras);
  return rows.flatMap((row) =>
    normalizeUnits(row.units)
      .filter((u) => u.icalUrl)
      .map((u) => ({ propertyId: row.propertyId, unitSlug: u.slug, icalUrl: u.icalUrl }))
  );
}

/** Jedinice za više vikendica odjednom (vlasnički dashboard). */
export async function getUnitsForProperties(propertyIds: number[]): Promise<Map<number, PropertyUnit[]>> {
  const map = new Map<number, PropertyUnit[]>();
  if (propertyIds.length === 0) return map;
  await ensureUnitTables();
  const rows = await db.select().from(propertyExtras).where(inArray(propertyExtras.propertyId, propertyIds));
  for (const row of rows) {
    const units = normalizeUnits(row.units);
    if (units.length > 0) map.set(row.propertyId, units);
  }
  return map;
}
