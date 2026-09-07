import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  listSubscriptions,
  getSubscriptionStats,
  getSubscriptionsYearlyByMonth,
  listProperties,
  listCompanies,
} from "@/lib/db/queries";
import { createSubscriptionAction } from "@/lib/actions";
import { currentYearMonthZagreb, todayDateStringZagreb } from "@/lib/date";
import SubscriptionForm from "@/components/admin/SubscriptionForm";
import SubscriptionsTable from "@/components/admin/SubscriptionsTable";
import YearlyBarChart from "@/components/admin/YearlyBarChart";
import Link from "next/link";

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
 * Financije — NOVO-ove vlastite mjesečne pretplate klijentima (izrada +
 * održavanje stranice), potpuno odvojeno od Prodaja (jednokratna zarada
 * agencije) i Rezervacije/Troškovi (zarada VIKENDICE za vlasnika). Samo
 * glavni admin/superadmini (requireSuperAdmin) — vidi lib/db/schema.ts
 * subscriptions.
 */
export default async function AdminFinancijePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (!admin.isSuperAdmin) redirect("/admin");

  const sp = await searchParams;
  const nowZagreb = currentYearMonthZagreb();
  const year = sp.year ? Number(sp.year) : nowZagreb.year;

  const [subscriptions, stats, yearlyNewCount, properties, companies] = await Promise.all([
    listSubscriptions(),
    getSubscriptionStats(),
    getSubscriptionsYearlyByMonth(year),
    listProperties(),
    listCompanies(),
  ]);

  const today = todayDateStringZagreb();
  const expiringSoon = subscriptions.filter((s) => {
    if (s.status !== "active" && s.status !== "trial") return false;
    const cutoff = new Date(`${today}T12:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() + 7);
    return s.nextRenewalDate <= cutoff.toISOString().slice(0, 10);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Financije</h1>
        <p className="text-xs text-black/50 mt-0.5">
          NOVO-ove mjesečne pretplate klijentima za izradu i održavanje stranice — vidljivo samo
          glavnom adminu. Odvojeno od{" "}
          <Link href="/admin/prodaja" className="underline">
            Prodaje
          </Link>
          .
        </p>
      </div>

      {expiringSoon.length > 0 && (
        <div className="border border-[#ff7f00]/40 bg-[#ff7f00]/5 rounded-xl px-4 py-3 flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {expiringSoon.length} {expiringSoon.length === 1 ? "pretplata ističe" : "pretplata ističe"} uskoro
            (7 dana)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {expiringSoon.map((s) => (
              <span
                key={s.id}
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-[#ff7f00]/30"
              >
                {s.sourceName} · {s.nextRenewalDate}
              </span>
            ))}
          </div>
        </div>
      )}

      <section className="admin-animate-grid grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="MRR (mjesečno)" value={stats.mrrEur} suffix=" €" />
        <StatCard label="Aktivne" value={stats.activeCount} />
        <StatCard label="Na probnom periodu" value={stats.trialCount} />
        <StatCard label="Ističe uskoro" value={stats.expiringSoonCount} />
        <StatCard label="Otkazane" value={stats.cancelledCount} />
      </section>

      <YearlyBarChart key={year} data={yearlyNewCount} year={year} color="#0000c3" />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">Sve pretplate</h2>
        <SubscriptionsTable subscriptions={subscriptions} today={today} />
      </section>

      <SubscriptionForm
        properties={properties}
        companies={companies}
        action={createSubscriptionAction}
        submitLabel="Dodaj pretplatu"
      />
    </div>
  );
}
