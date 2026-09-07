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
export default function OwnerMiniCalendar({
  propertyId,
  propertyName,
  blocked,
  now,
}: {
  propertyId: number;
  propertyName: string;
  blocked: { date: string }[];
  now: Date;
}) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = miniMondayIndex(firstOfMonth);
  const blockedSet = new Set(blocked.map((b) => b.date));
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--od-ink-faint)" }}>
          {MINI_MONTH_NAMES[month]} — {propertyName}
        </h2>
        <Link href={`/admin/kalendar?property=${propertyId}`} className="text-xs font-semibold text-[#ff7f00]">
          Puni kalendar →
        </Link>
      </div>
      {/* NAMJERNO bez max-w-xs (naslijeđeno iz MiniCalendar.tsx, gdje ima
          smisla jer sjedi pored drugog sadržaja) — ovdje je kalendar
          samostalan red u istom okomitom nizu kao i sve ostale kartice
          (bedževi, statistike, grafovi), pa mora dijeliti njihovu punu
          širinu, inače na mobitelu izgleda uže od svega ostalog (feedback:
          "kalendar nije jednako sirok kao sve ostalo"). */}
      <div className="owner-glass owner-glass-grain rounded-2xl p-4">
        <div className="grid grid-cols-7 gap-1 text-center">
          {MINI_WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-[10px] font-semibold py-0.5" style={{ color: "var(--od-ink-faint)" }}>
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`b-${i}`} />;
            const dateStr = `${year}-${miniPad2(month + 1)}-${miniPad2(day)}`;
            const isBlocked = blockedSet.has(dateStr);
            return (
              <div
                key={dateStr}
                className={
                  "aspect-square rounded-lg text-[10px] font-semibold flex items-center justify-center " +
                  (isBlocked ? "owner-cal-cell-blocked" : "owner-cal-cell-free")
                }
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
