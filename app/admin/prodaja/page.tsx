import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { listSales, getSalesMonthlyEarnings, getSalesYearlyByMonth } from "@/lib/db/queries";
import SaleForm from "@/components/admin/SaleForm";
import SalesTable from "@/components/admin/SalesTable";
import YearlyBarChart from "@/components/admin/YearlyBarChart";
import { currentYearMonthZagreb } from "@/lib/date";

const MONTH_NAMES = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];
const CATEGORY_LABELS: Record<string, string> = {
  stranica: "Izrada stranice",
  proizvod: "Proizvod",
  konzultacija: "Konzultacija",
  ostalo: "Ostalo",
};

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="border border-black/10 rounded-xl px-4 py-3 bg-white">
      <div className="text-2xl font-bold tabular-nums">
        {value}
        {suffix ?? ""}
      </div>
      <div className="text-xs text-black/50 mt-0.5">{label}</div>
    </div>
  );
}

/**
 * Zarada AGENCIJE (ne vikendica) — prodaja stranica, proizvoda, konzultacija.
 * Samo za pune admine (requireFullAdmin), potpuno odvojeno od /admin/rezervacije
 * koja je po vikendici za vlasnike. Vidi lib/db/schema.ts sales.
 */
export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requireFullAdmin();
  const sp = await searchParams;

  const nowZagreb = currentYearMonthZagreb();
  const year = sp.year ? Number(sp.year) : nowZagreb.year;
  const month = sp.month ? Number(sp.month) : nowZagreb.month; // 1-12
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const isCurrentMonth = year === nowZagreb.year && month === nowZagreb.month;

  const [sales, earnings, yearlyTotals] = await Promise.all([
    listSales(),
    getSalesMonthlyEarnings(monthPrefix),
    getSalesYearlyByMonth(year),
  ]);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthLinkFor = (y: number, m: number) => `/admin/prodaja?year=${y}&month=${m}`;

  const categoryEntries = Object.entries(earnings.byCategory).sort((a, b) => b[1] - a[1]);
  const categoryMax = Math.max(1, ...categoryEntries.map(([, v]) => v));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Zarada agencije</h1>
        <p className="text-xs text-black/50 mt-0.5">
          Prodaja stranica, proizvoda i usluga — odvojeno od zarade vikendica (vidi{" "}
          <Link href="/admin/vikendice" className="underline">
            Vikendice
          </Link>
          ). Ručni unos jer nema online naplate u sustavu.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/40">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <div className="flex items-center gap-2">
            <Link href={monthLinkFor(prevYear, prevMonth)} className="admin-quicklink">
              ← Prošli
            </Link>
            {!isCurrentMonth && (
              <Link href="/admin/prodaja" className="text-xs font-semibold text-[#ff7f00]">
                Ovaj mjesec
              </Link>
            )}
            <Link href={monthLinkFor(nextYear, nextMonth)} className="admin-quicklink">
              Sljedeći →
            </Link>
          </div>
        </div>
        <div className="admin-animate-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Zarada ovaj mjesec" value={earnings.totalEur} suffix=" €" />
          <StatCard label="Broj prodaja" value={earnings.count} />
          <StatCard
            label="Prosjek po prodaji"
            value={earnings.count > 0 ? Math.round(earnings.totalEur / earnings.count) : 0}
            suffix=" €"
          />
        </div>
      </section>

      {categoryEntries.length > 0 && (
        <section className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Raščlamba po kategoriji — {MONTH_NAMES[month - 1]}
          </span>
          <div className="flex flex-col gap-2">
            {categoryEntries.map(([cat, value]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs w-32 shrink-0 text-black/60">{CATEGORY_LABELS[cat] ?? cat}</span>
                <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
                  <div
                    className="admin-bar-grow h-full rounded-full bg-[#0000c3]"
                    style={{ width: `${(value / categoryMax) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums w-16 text-right">{value} €</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <YearlyBarChart key={year} data={yearlyTotals} year={year} color="#0000c3" />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">Sve prodaje</h2>
          {sales.length > 0 && (
            <Link
              href="/api/admin/sales/export"
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
            >
              Izvezi CSV
            </Link>
          )}
        </div>
        <SalesTable sales={sales} />
      </section>

      <SaleForm redirectTo="/admin/prodaja" />
    </div>
  );
}
