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
  getClientHealthSignals,
} from "@/lib/db/queries";
import { describeSubscription } from "@/lib/subscriptionState";
import { scoreClientHealth } from "@/lib/clientHealth";
import { createSubscriptionAction } from "@/lib/actions";
import { currentYearMonthZagreb, todayDateStringZagreb } from "@/lib/date";
import SubscriptionForm from "@/components/admin/SubscriptionForm";
import SaleForm from "@/components/admin/SaleForm";
import AgencyLedgerTable from "@/components/admin/AgencyLedgerTable";
import YearlyBarChart from "@/components/admin/YearlyBarChart";
import Link from "next/link";
import { StatCard } from "@/components/admin/StatCard";

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

  const [subscriptions, subStats, subValueByMonth, properties, companies, sales, salesThisMonth, salesByMonth, healthSignals] =
    await Promise.all([
      listSubscriptions(),
      getSubscriptionStats(),
      getSubscriptionsValueYearlyByMonth(year),
      listProperties(),
      listCompanies(),
      listSales(),
      getSalesMonthlyEarnings(monthPrefix),
      getSalesYearlyByMonth(year),
      getClientHealthSignals(),
    ]);

  const today = todayDateStringZagreb();
  // Plan #16: što treba naplatiti — računa se iz datuma (kasni / naplata uskoro).
  const needsPayment = subscriptions
    .map((s) => ({ s, st: describeSubscription(s, today) }))
    .filter((x) => x.st.needsPayment)
    .sort((a, b) => b.st.daysLate - a.st.daysLate || a.s.nextRenewalDate.localeCompare(b.s.nextRenewalDate));

  // Plan #19: zdravlje klijenata — prvo oni s rizikom.
  const health = healthSignals.map((c) => scoreClientHealth(c, today));
  const order = { rizik: 0, pratiti: 1, dobro: 2 } as const;
  const attention = health.filter((h) => h.level !== "dobro").sort((a, b) => order[a.level] - order[b.level]);
  const healthyCount = health.length - attention.length;

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

      {needsPayment.length > 0 && (
        <div className="border border-[#ff7f00]/40 bg-[#ff7f00]/5 rounded-xl px-4 py-3 flex flex-col gap-2">
          <span className="text-sm font-semibold">
            {needsPayment.length === 1 ? "1 pretplata čeka uplatu" : `${needsPayment.length} pretplate čekaju uplatu`}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {needsPayment.map(({ s, st }) => (
              <Link
                key={s.id}
                href={`/admin/financije/${s.id}`}
                className={
                  "text-xs font-semibold px-2.5 py-1 rounded-full bg-white border " +
                  (st.daysLate > 0 ? "border-[#d70015]/40 text-[#b80012]" : "border-[#ff7f00]/30")
                }
              >
                {s.sourceName} · {st.label}
              </Link>
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
          <StatCard label={subStats.trialMrrEur > 0 ? `MRR — plaćene pretplate (+${subStats.trialMrrEur} € nakon probnih)` : "MRR — plaćene pretplate"} value={subStats.mrrEur} suffix=" €" />
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

      <section className="flex flex-col gap-3" aria-labelledby="zdravlje-naslov">
        <h2 id="zdravlje-naslov" className="text-xs font-semibold uppercase tracking-wide text-black/60">
          Zdravlje klijenata
        </h2>
        {attention.length === 0 ? (
          <p className="text-sm text-black/70">
            Svih {health.length} klijenata je u redu: plaćaju na vrijeme, stranice imaju posjete i vlasnici ulaze.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attention.map((h) => (
              <li key={`${h.source}-${h.sourceId}`} className="neu-card px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <span className={"health-dot health-" + h.level} aria-hidden="true" />
                    {h.name}
                    <span className="text-[11px] font-semibold text-black/60">{h.level === "rizik" ? "Rizik" : "Pratiti"}</span>
                  </div>
                  <p className="text-xs text-black/70 mt-0.5">{h.reasons.join(" · ")}</p>
                </div>
                <Link
                  href={
                    h.subscriptionId && h.reasons.some((r) => r.startsWith("Uplata"))
                      ? `/admin/financije/${h.subscriptionId}`
                      : h.source === "property"
                        ? `/admin/vikendice/${h.sourceId}`
                        : `/admin/companies/${h.sourceId}`
                  }
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40 shrink-0"
                >
                  Otvori
                </Link>
              </li>
            ))}
          </ul>
        )}
        {attention.length > 0 && healthyCount > 0 && (
          <p className="text-xs text-black/60">Ostalih {healthyCount} klijenata je u redu.</p>
        )}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
