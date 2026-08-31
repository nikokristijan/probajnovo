import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { listProperties, listInquiries, getMonthlyEarnings, listBlockedDates } from "@/lib/db/queries";
import { currentYearMonthZagreb } from "@/lib/date";

/**
 * Hub "Vikendice" za pune admine — zamjena za tri zasebna top-level taba
 * (Kalendar/Rezervacije/Upiti) koji su zajedno prikazivali SVE vikendice
 * odjednom i postajali krcati kako raste broj vikendica. Ovdje admin prvo
 * bira vikendicu (kartice ispod), a tek onda vidi kalendar/rezervacije/upite
 * baš za nju na /admin/vikendice/[id]. Vidi app/admin/layout.tsx nav.
 */
export default async function AdminVikendicePage() {
  await requireFullAdmin();

  const [properties, inquiries] = await Promise.all([listProperties(), listInquiries()]);
  const nowZagreb = currentYearMonthZagreb();
  const monthPrefix = `${nowZagreb.year}-${String(nowZagreb.month).padStart(2, "0")}`;

  const cards = await Promise.all(
    properties.map(async (p) => {
      const [earnings, blocked] = await Promise.all([
        getMonthlyEarnings([p.id], monthPrefix),
        listBlockedDates(p.id),
      ]);
      const pendingCount = inquiries.filter(
        (i) => i.source === "property" && i.sourceId === p.id && !i.read
      ).length;
      const daysBooked = blocked.filter((b) => b.date.startsWith(monthPrefix)).length;
      return { property: p, earnings, pendingCount, daysBooked };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Vikendice</h1>
        <p className="text-xs text-black/50 mt-0.5">
          Odaberi vikendicu za kalendar, rezervacije i upite baš za nju.
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-black/60">Još nema dodanih vikendica.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {cards.map(({ property: p, earnings, pendingCount, daysBooked }) => (
            <Link
              key={p.id}
              href={`/admin/vikendice/${p.id}`}
              className="border border-black/10 rounded-xl px-5 py-4 bg-white hover:border-[#ff7f00]/50 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-black/50 mt-0.5">{p.location}</div>
                </div>
                {pendingCount > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ff7f00]/10 text-[#ff7f00] shrink-0">
                    {pendingCount} {pendingCount === 1 ? "novi upit" : "novih upita"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-black/60">
                <span>
                  <span className="font-semibold tabular-nums">{daysBooked}</span> dana zauzeto
                </span>
                <span>
                  <span className="font-semibold tabular-nums">{earnings.netEur} €</span> ovaj mjesec
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
