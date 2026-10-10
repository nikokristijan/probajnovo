/**
 * Noćna pauza za poruke gostima s jelovnika: od 22:00 do 09:00 po vremenu tvrtke (zadano Europe/Zagreb) ništa se ne šalje.
 * Čisto (bez baze i bez server-only), s vremenom kao argumentom, pa se isti kod koristi pri zakazivanju
 * (services/guests.ts), pri slanju (services/automation-engine.ts) i u testovima.
 *
 * Granice: 22:00:00 je već noć, 09:00:00 je već dan ([22:00, 09:00) je pauza). Prelazak na ljetno/zimsko vrijeme
 * rješava se preko Intl (IANA baza), nikad ručnim pomakom od sata.
 */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 9;
export const DEFAULT_TIME_ZONE = "Europe/Zagreb";

/** Vraća ispravnu IANA zonu ili Europe/Zagreb (neispravna zona nikad ne smije srušiti slanje). */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Kalendarski sat i datum trenutka u zadanoj zoni. */
export function zonedParts(at: Date, tz: string = DEFAULT_TIME_ZONE): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of formatter(safeTimeZone(tz)).formatToParts(at)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour % 24, minute: out.minute, second: out.second };
}

/** Pomak zone od UTC-a u minutama u zadanom trenutku (CET = 60, CEST = 120). */
function offsetMinutes(at: Date, tz: string): number {
  const p = zonedParts(at, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const real = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((asUtc - real) / 60_000);
}

/** Trenutak (UTC) u kojem je zidni sat zone točno zadani datum i vrijeme. Radi i oko prelaska na ljetno vrijeme. */
export function zonedWallTimeToUtc(tz: string, year: number, month: number, day: number, hour: number, minute = 0): Date {
  const zone = safeTimeZone(tz);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMinutes(new Date(guess), zone);
  let utc = guess - first * 60_000;
  const second = offsetMinutes(new Date(utc), zone);
  if (second !== first) utc = guess - second * 60_000;
  return new Date(utc);
}

/** Je li trenutak u noćnoj pauzi [22:00, 09:00) po vremenu zone. */
export function isQuietHour(at: Date, tz: string = DEFAULT_TIME_ZONE): boolean {
  const { hour } = zonedParts(at, tz);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/**
 * Prvi trenutak izvan noćne pauze: sam `at` ako je već dan, inače 09:00 istog dana (prije 09:00) ili sljedećeg jutra (od 22:00).
 */
export function shiftOutOfQuietHours(at: Date, tz: string = DEFAULT_TIME_ZONE): Date {
  const zone = safeTimeZone(tz);
  const p = zonedParts(at, zone);
  if (p.hour >= QUIET_END_HOUR && p.hour < QUIET_START_HOUR) return at;
  // Kalendarski dan +1 računa se u UTC-u (bez DST-a), tek onda se 09:00 vraća u stvarni trenutak.
  const dayOffset = p.hour >= QUIET_START_HOUR ? 1 : 0;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset));
  return zonedWallTimeToUtc(zone, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), QUIET_END_HOUR, 0);
}

/**
 * Kad treba poslati zahtjev za recenziju gostu: `delayMinutes` nakon unosa broja, a ako to pada u noćnu pauzu,
 * u 09:00 sljedećeg jutra (ili istog dana, ako je tek prošla ponoć).
 */
export function computeVenueSendAt(now: Date, delayMinutes: number, tz: string = DEFAULT_TIME_ZONE): Date {
  return shiftOutOfQuietHours(new Date(now.getTime() + delayMinutes * 60_000), tz);
}
