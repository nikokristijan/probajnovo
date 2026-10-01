"use client";

import { useState } from "react";
import Link from "next/link";

const MINI_MONTH_NAMES = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];
const MINI_WEEKDAY_LABELS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

function miniPad2(n: number): string {
  return String(n).padStart(2, "0");
}

function miniMondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Stakleni (liquid glass) klon components/admin/MiniCalendar.tsx, SAMO za
    vlasnički dashboard (app/admin/page.tsx OwnerDashboard) — namjerno
    ODVOJENA komponenta, ne izmjena originala, jer MiniCalendar.tsx dijeli
    i /admin/vikendice/[id] (puni admini), gdje mora ostati u dosadašnjem
    jednostavnom bijelom stilu. Ista logika/props kao original, samo klase
    koriste .owner-glass sustav iz globals.css umjesto plosnate bijele
    kartice. `now` mora doći iz currentYearMonthZagreb() (vidi lib/date.ts)
    — golo `new Date()` bi oko ponoći pokazalo pogrešan (UTC) mjesec. */
type MiniCalProperty = {
  id: number;
  name: string;
  blocked: { date: string; source: string }[];
};

/** Plan #33: jedna boja za "rezervirano" svugdje — navy = rezervacija,
    prigušeno sivo = ručno blokirano, isprekidani rub = iCal (Booking/Airbnb).
    Crvena ostaje samo za greške. */
function cellClass(source: string | undefined): string {
  if (source === "reservation") return "owner-cal-cell-reservation";
  if (source === "ical") return "owner-cal-cell-ical";
  if (source) return "owner-cal-cell-blocked";
  return "owner-cal-cell-free";
}

const SOURCE_LABEL: Record<string, string> = {
  reservation: "rezervacija",
  ical: "Booking/Airbnb",
  manual: "ručno blokirano",
};

export default function OwnerMiniCalendar({
  properties,
  now,
}: {
  properties: MiniCalProperty[];
  now: Date;
}) {
  // Plan #48: prekidač između vikendica umjesto samo prve.
  const [activeId, setActiveId] = useState(properties[0]?.id);
  const active = properties.find((p) => p.id === activeId) ?? properties[0];
  if (!active) return null;

  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = miniMondayIndex(firstOfMonth);
  const sourceByDate = new Map(active.blocked.map((b) => [b.date, b.source]));
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const usedSources = new Set(
    active.blocked.filter((b) => b.date.startsWith(`${year}-${miniPad2(month + 1)}`)).map((b) => b.source)
  );

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--od-ink-faint)" }}>
          {MINI_MONTH_NAMES[month]}
          {properties.length === 1 ? ` — ${active.name}` : ""}
        </h2>
        <Link
          href={`/admin/kalendar?property=${active.id}`}
          className="text-xs font-semibold text-[var(--neu-accent-ink,#b35600)]"
        >
          Puni kalendar →
        </Link>
      </div>
      {properties.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label="Vikendica">
          {properties.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === active.id}
              onClick={() => setActiveId(p.id)}
              className={"owner-quicklink !text-xs !py-1 !px-3" + (p.id === active.id ? " owner-quicklink-active" : "")}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="owner-glass owner-glass-grain rounded-2xl p-4">
        <div className="grid grid-cols-7 gap-1 text-center">
          {MINI_WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-[11px] font-semibold py-0.5" style={{ color: "var(--od-ink-faint)" }}>
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`b-${i}`} />;
            const dateStr = `${year}-${miniPad2(month + 1)}-${miniPad2(day)}`;
            const source = sourceByDate.get(dateStr);
            return (
              <div
                key={dateStr}
                title={source ? SOURCE_LABEL[source] ?? "zauzeto" : "slobodno"}
                className={
                  "aspect-square rounded-lg text-[11px] font-semibold flex items-center justify-center " +
                  cellClass(source)
                }
              >
                {day}
              </div>
            );
          })}
        </div>
        {usedSources.size > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px]" style={{ color: "var(--od-ink-soft)" }}>
            {(["reservation", "manual", "ical"] as const)
              .filter((src) => usedSources.has(src))
              .map((src) => (
                <span key={src} className="flex items-center gap-1.5">
                  <span className={"w-2.5 h-2.5 rounded-full inline-block " + cellClass(src)} />
                  {SOURCE_LABEL[src]}
                </span>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
