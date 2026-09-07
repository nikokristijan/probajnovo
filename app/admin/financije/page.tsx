import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  listSubscriptions,
  getSubscriptionStats,
  getSubscriptionsValueYearlyByMonth,
  listProperties,
  listCompanies,
  listSales,
  getSalesMonthlyEarnings,
  getSalesYearlyByMonth,
} from "@/lib/db/queries";
import { createSubscriptionAction } from "@/lib/actions";
import { currentYearMonthZagreb, todayDateStringZagreb } from "@/lib/date";
import SubscriptionForm from "@/components/admin/SubscriptionForm";
import SaleForm from "@/components/admin/SaleForm";
import AgencyLedgerTable from "@/components/admin/AgencyLedgerTable";
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
 * Financije — spojeni pregled NOVO-ove vlastite zarade od agencije:
 * ponavljajuće pretplate klijentima (bivši /admin/financije, subscriptions)
 * I jednokratna prodaja stranica/proizvoda/usluga (bivši /admin/prodaja,
 * sales) — na izričit zahtjev korisnika spojeno u JEDNU stranicu s JEDNOM
 * tablicom (vidi AgencyLedgerTable), umjesto dvije odvojene rute. I dalje
 * potpuno odvojeno od zarade VIKENDICA za vlasnike (vidi /admin/rezervacije,
 * getMonthlyEarnings) — ovo je isključivo prihod same agencije. Samo glavni
 * admin/superadmini (isti gate kao stari /admin/financije — stroži od
 * requireFullAdmin koji je čuvao stari /admin/prodaja, po izričitoj
 * potvrdi korisnika da su "oboje za superadmine"). /admin/prodaja sad samo
 * preusmjerava ovamo (vidi tu datoteku) da stari linkovi ne pucaju.
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
  const monthPrefix = `${nowZagreb.year}-${String(nowZagreb.month).padStart(2, "0")}`;

  const [subscriptions, subStats, subValueByMonth, properties, companies, sales, salesThisMonth, salesByMonth] =
    await Promise.all([
      listSubscriptions(),
      getSubscriptionStats(),
      getSubscriptionsValueYearlyByMonth(year),
      listProperties(),
      listCompanies(),
      listSales(),
      getSalesMonthlyEarnings(monthPrefix),
      getSalesYearlyByMonth(year),
    ]);

  const today = todayDateStringZagreb();
  const expiringSoon = subscriptions.filter((s) => {
    if (s.status !== "active" && s.status !== "trial") return false;
    const cutoff = new Date(`${today}T12:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() + 7);
    return s.nextRenewalDate <= cutoff.toISOString().slice(0, 10);
  });

  // "Jedan zbrojeni promet" po mjesecu — prodaja (stvarno primljen novac tog
  // mjeseca) + vrijednost NOVIH pretplata pokrenutih tog mjeseca (vidi
  // napomenu uz getSubscriptionsValueYearlyByMonth zašto je ovo aproksimacija,
  // ne pravo mjesečno priznavanje prihoda). Kombinirano ukupno ovaj mjesec
  // koristi MRR (ne samo "nove" pretplate) jer bolje odgovara pitanju
  // "koliko agencija zarađuje mjesečno sad" nego samo novopotpisano.
  const combinedByMonth = salesByMonth.map((v, i) => v + subValueByMonth[i]);
  const combinedTotalThisMonth = salesThisMonth.totalEur + subStats.mrrEur;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Financije</h1>
        <p className="text-xs text-black/50 mt-0.5">
          Zarada agencije — NOVO-ove mjesečne pretplate klijentima I jednokratna prodaja stranica,
          proizvoda i usluga, u jednom pregledu. Vidljivo samo glavnom adminu. Odvojeno od zarade{" "}
          <Link href="/admin/vikendice" className="underline">
            vikendica
          </Link>{" "}
          za vlasnike.
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

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Ukupan promet — {nowZagreb.month}/{nowZagreb.year}
        </h2>
        <div className="admin-animate-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Ukupno ovaj mjesec (MRR + prodaja)" value={combinedTotalThisMonth} suffix=" €" />
          <StatCard label="MRR — pretplate" value={subStats.mrrEur} suffix=" €" />
          <StatCard label="Prodaja ovaj mjesec" value={salesThisMonth.totalEur} suffix=" €" />
        </div>
      </section>

      <section className="admin-animate-grid grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Aktivne pretplate" value={subStats.activeCount} />
        <StatCard label="Na probnom periodu" value={subStats.trialCount} />
        <StatCard label="Ističe uskoro" value={subStats.expiringSoonCount} />
        <StatCard label="Otkazane pretplate" value={subStats.cancelledCount} />
        <StatCard label="Broj prodaja ovaj mjesec" value={salesThisMonth.count} />
      </section>

      <YearlyBarChart key={year} data={combinedByMonth} year={year} color="#0000c3" />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Sve pretplate i prodaje
          </h2>
          {sales.length > 0 && (
            <Link
              href="/api/admin/sales/export"
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
            >
              Izvezi prodaje (CSV)
            </Link>
          )}
        </div>
        <AgencyLedgerTable subscriptions={subscriptions} sales={sales} today={today} />
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <SubscriptionForm
          properties={properties}
          companies={companies}
          action={createSubscriptionAction}
          submitLabel="Dodaj pretplatu"
        />
        <SaleForm redirectTo="/admin/financije" />
      </div>
    </div>
  );
}
