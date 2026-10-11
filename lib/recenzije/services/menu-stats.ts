import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { automationRuns, menuGuests, organizations, type GuestOutcome } from "@/lib/recenzije/db/schema";
import { normalizeTableLabel, type VenueWeekly } from "@/lib/recenzije/menu-stats-format";

/**
 * Statistika stolova digitalnog jelovnika, iz tablice nr_menu_guests (jedan redak = jedan gost koji je na vratima jelovnika
 * ostavio broj; pregledi bez broja se ne bilježe, pa to NISU "skeniranja" nego gosti koji su ostavili broj).
 *
 * - Sve je uvjetovano organization_id AKTIVNE tvrtke, pa podaci druge tvrtke nikad ne dolaze u rezultat.
 * - Dan u tjednu i sat računaju se u vremenskoj zoni tvrtke (AT TIME ZONE), pa vrijede i oko pomaka ljetnog računanja vremena.
 * - Oznaka stola je nepouzdan unos iz ?stol=: čisti se u normalizeTableLabel (A-Z, 0-9, razmak, crtica; najviše 12 znakova),
 *   a prazno je "bez stola". Zbroj se radi u JavaScriptu nad najviše MAX_LABELS najčešćih sirovih oznaka; ostatak (dugi rep
 *   neobičnih vrijednosti) ulazi u "ostalo", pa je odgovor ograničen i uz zlonamjerne unose.
 */

const MAX_LABELS = 400;
export const STATS_PERIODS = [7, 30] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export type TableStat = { label: string; count: number; unique: number };

export type MenuStats = {
  days: number;
  from: Date;
  to: Date;
  timezone: string;
  /** Svi unosi u razdoblju. */
  total: number;
  /** Različiti brojevi mobitela u razdoblju. */
  uniqueNumbers: number;
  /** Unosi bez oznake stola (nema ?stol= ili je neispravan). */
  withoutTable: number;
  /** Stolovi po broju unosa, silazno (bez "bez stola"); najviše 12, ostatak je u `otherTables`. */
  tables: TableStat[];
  /** Unosi na stolovima koji nisu u prikazanih 12 (zbroj ostalih oznaka). */
  otherTables: number;
  /** Unosi po danu u tjednu (indeks 0 = ponedjeljak ... 6 = nedjelja) u zoni tvrtke. */
  byWeekday: number[];
  /** Unosi po satu u danu (indeks 0 do 23) u zoni tvrtke. */
  byHour: number[];
  /** Što se dogodilo sa zahtjevom za recenziju: zakazan, poslan i razlozi zašto nije. */
  requests: { scheduled: number; sent: number; skipped: number; byOutcome: Partial<Record<GuestOutcome, number>> };
  /** Najposjećeniji stol (ne računa "bez stola") ili null. */
  topTable: { label: string; count: number } | null;
  peakHour: number | null;
  peakWeekday: number | null;
};

function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("hr-HR", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/Zagreb";
  }
}

/** Najveći element niza (prvi pri izjednačenju) ili null kad je sve nula. */
function argMax(values: number[]): number | null {
  let best = -1;
  let at: number | null = null;
  values.forEach((v, i) => {
    if (v > best && v > 0) {
      best = v;
      at = i;
    }
  });
  return at;
}

/**
 * Zbraja redove grupirane po sirovoj oznaci u stolove po očišćenoj oznaci. `rows` su već ograničeni (MAX_LABELS), a
 * `total` je ukupan broj unosa: što nije pokriveno redovima, ide u "ostalo". Izvezeno radi jediničnog testa.
 */
export function aggregateTables(
  rows: { label: string | null; count: number; unique: number }[],
  total: number
): { withoutTable: number; tables: TableStat[]; otherTables: number } {
  const map = new Map<string, TableStat>();
  let withoutTable = 0;
  let covered = 0;
  for (const r of rows) {
    covered += r.count;
    const label = normalizeTableLabel(r.label);
    if (!label) {
      withoutTable += r.count;
      continue;
    }
    const cur = map.get(label);
    // Isti broj telefona može stajati pod dvije sirove oznake istog stola; gornja granica zbroja je ionako samo informativna.
    if (cur) {
      cur.count += r.count;
      cur.unique += r.unique;
    } else map.set(label, { label, count: r.count, unique: r.unique });
  }
  // Dugi rep sirovih oznaka (preko granice upita) nije moguće razlikovati od "bez stola", pa je to "ostalo".
  const tail = Math.max(0, total - covered);
  const sorted = [...map.values()]
    .map((t) => ({ ...t, unique: Math.min(t.unique, t.count) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "hr", { numeric: true }));
  const shown = sorted.slice(0, 12);
  const otherTables = sorted.slice(12).reduce((n, t) => n + t.count, 0) + tail;
  return { withoutTable, tables: shown, otherTables };
}

/** Statistika za razdoblje [now - days, now). `now` je parametar radi testova. */
export async function getMenuStats(organizationId: string, days: number, now: Date = new Date()): Promise<MenuStats> {
  await ensureReviewsDb();
  const d = Math.min(366, Math.max(1, Math.floor(days)));
  const from = new Date(now.getTime() - d * 86_400_000);
  const [org] = await db.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const tz = safeZone(org?.timezone ?? "Europe/Zagreb");
  const inRange = and(eq(menuGuests.organizationId, organizationId), gte(menuGuests.createdAt, from), lt(menuGuests.createdAt, now));
  const local = sql`${menuGuests.createdAt} at time zone ${tz}`;

  const [[totals], labelRows, clockRows, outcomeRows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int`, unique: sql<number>`count(distinct ${menuGuests.phone})::int` })
      .from(menuGuests)
      .where(inRange),
    db
      .select({ label: menuGuests.tableLabel, count: sql<number>`count(*)::int`, unique: sql<number>`count(distinct ${menuGuests.phone})::int` })
      .from(menuGuests)
      .where(inRange)
      .groupBy(menuGuests.tableLabel)
      .orderBy(sql`count(*) desc`, menuGuests.tableLabel)
      .limit(MAX_LABELS),
    db
      .select({
        dow: sql<number>`extract(isodow from ${local})::int`,
        hour: sql<number>`extract(hour from ${local})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(menuGuests)
      .where(inRange)
      .groupBy(sql`1`, sql`2`),
    db
      .select({
        outcome: menuGuests.outcome,
        count: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) filter (where exists (select 1 from nr_messages m where m.automation_run_id = ${automationRuns.id} and m.status in ('SENT', 'DELIVERED')))::int`,
      })
      .from(menuGuests)
      .leftJoin(automationRuns, eq(automationRuns.id, menuGuests.runId))
      .where(inRange)
      .groupBy(menuGuests.outcome),
  ]);

  const byWeekday = Array<number>(7).fill(0);
  const byHour = Array<number>(24).fill(0);
  for (const r of clockRows) {
    if (r.dow >= 1 && r.dow <= 7) byWeekday[r.dow - 1] += r.count;
    if (r.hour >= 0 && r.hour <= 23) byHour[r.hour] += r.count;
  }
  const agg = aggregateTables(labelRows, totals.total);
  const byOutcome: Partial<Record<GuestOutcome, number>> = {};
  let sent = 0;
  for (const r of outcomeRows) {
    byOutcome[r.outcome] = r.count;
    sent += r.sent;
  }
  const scheduled = byOutcome.scheduled ?? 0;
  const top = agg.tables[0];
  return {
    days: d,
    from,
    to: now,
    timezone: tz,
    total: totals.total,
    uniqueNumbers: totals.unique,
    withoutTable: agg.withoutTable,
    tables: agg.tables,
    otherTables: agg.otherTables,
    byWeekday,
    byHour,
    requests: { scheduled, sent, skipped: totals.total - scheduled, byOutcome },
    topTable: top ? { label: top.label, count: top.count } : null,
    peakHour: argMax(byHour),
    peakWeekday: argMax(byWeekday),
  };
}

/** Sažetak za tjedni izvještaj ugostitelja (7 dana). */
export async function getVenueWeekly(organizationId: string, captureEnabled: boolean, now: Date = new Date()): Promise<VenueWeekly> {
  const s = await getMenuStats(organizationId, 7, now);
  return { guests: s.total, captureEnabled, topTable: s.topTable, peakHour: s.peakHour };
}
