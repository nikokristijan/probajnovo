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

/** Sitan, čitanjem-only kalendar tekućeg mjeseca za jednu vikendicu — brzi
    pregled zauzetosti bez odlaska na puni /admin/kalendar (gdje se dani mogu
    i uređivati). Izdvojeno iz app/admin/page.tsx da ga dijele vlasnički
    dashboard i /admin/vikendice/[id] (hub za pune admine). `now` mora doći
    iz currentYearMonthZagreb() (vidi lib/date.ts) — golo `new Date()` bi
    oko ponoći pokazalo pogrešan (UTC) mjesec. */
export default function MiniCalendar({
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
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
          {MINI_MONTH_NAMES[month]} — {propertyName}
        </h2>
        <Link href={`/admin/kalendar?property=${propertyId}`} className="text-xs font-semibold text-[#ff7f00]">
          Puni kalendar →
        </Link>
      </div>
      <div className="border border-black/10 rounded-xl p-4 bg-white max-w-xs">
        <div className="grid grid-cols-7 gap-1 text-center">
          {MINI_WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-[10px] font-semibold text-black/40 py-0.5">
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
                  "aspect-square rounded-md text-[10px] font-semibold flex items-center justify-center " +
                  (isBlocked ? "bg-red-500 text-white" : "bg-black/5")
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
