/**
 * Tanki, "best effort" parser za iCal (.ics) feedove koje Booking.com/Airbnb
 * daju za svaki oglas ("Export Calendar") — koristi ga cron endpoint
 * (app/api/cron/sync-ical) da automatski povuče zauzete datume u
 * property_blocked_dates (source="ical", vidi lib/db/schema.ts).
 *
 * Namjerno NE koristimo vanjsku ICS biblioteku — Airbnb/Booking feedovi su
 * jednostavni (jedan VEVENT po rezervaciji, DTSTART/DTEND kao cijeli dani),
 * pa je mali ručni parser dovoljan i ne dodaje novu ovisnost. Isti "best
 * effort" duh kao lib/translate.ts i lib/geocode.ts: greška ili prazan feed
 * vraća null/[], nikad ne ruši sync ostalih vikendica.
 */

/** Parsira "YYYYMMDD" ili "YYYYMMDDTHHMMSSZ" iCal datum u "YYYY-MM-DD". */
function toDateStr(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 8);
  if (digits.length !== 8) return null;
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sve datume u [start, end) rasponu (end je isključen — iCal DTEND je "checkout" dan, ne noćenje). */
function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur < end && guard < 730) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

/**
 * Parsira sirovi .ics tekst i vrati sve blokirane datume (unija svih VEVENT
 * DTSTART–DTEND raspona), bez duplikata. Redci se u iCal-u mogu nastaviti na
 * sljedećem retku uvučenim razmakom ("line folding") — prvo ih spojimo.
 */
export function parseIcsBlockedDates(ics: string): string[] {
  const unfolded = ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r\n|\n/);

  const dates = new Set<string>();
  let inEvent = false;
  let dtstart: string | null = null;
  let dtend: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      dtstart = null;
      dtend = null;
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (inEvent && dtstart) {
        const end = dtend ?? addDays(dtstart, 1);
        for (const d of datesInRange(dtstart, end)) dates.add(d);
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (trimmed.startsWith("DTSTART")) {
      const value = trimmed.split(":")[1];
      if (value) dtstart = toDateStr(value);
    } else if (trimmed.startsWith("DTEND")) {
      const value = trimmed.split(":")[1];
      if (value) dtend = toDateStr(value);
    }
  }

  return [...dates].sort();
}

/** Dohvati i parsiraj iCal feed s dane URL-a. `null` na bilo kakvu grešku (mrežni
    problem, ne-ics odgovor i sl.) — pozivatelj (cron) tad samo preskoči tu vikendicu. */
export async function fetchIcalBlockedDates(icalUrl: string): Promise<string[] | null> {
  try {
    const res = await fetch(icalUrl, { headers: { "User-Agent": "NOVO-probajnovo/1.0" } });
    if (!res.ok) {
      console.error("[fetchIcalBlockedDates] status", res.status, "za", icalUrl);
      return null;
    }
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) {
      console.error("[fetchIcalBlockedDates] odgovor ne izgleda kao .ics za", icalUrl);
      return null;
    }
    return parseIcsBlockedDates(text);
  } catch (err) {
    console.error("[fetchIcalBlockedDates] poziv nije uspio za", icalUrl, err);
    return null;
  }
}
