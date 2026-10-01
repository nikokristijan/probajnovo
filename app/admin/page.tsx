import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  listProperties,
  listCompanies,
  listStudies,
  listProducts,
  listNfcTags,
  countUnreadInquiries,
  listPropertiesForAdmin,
  listCompaniesForAdmin,
  listInquiriesForAdmin,
  listBlockedDates,
  getMonthlyEarnings,
  getSubscriptionStats,
  getOwnerMonthlyTrend,
  getPropertiesMonthlyBreakdown,
  countPageViewsSince,
  listReservationsForProperty,
} from "@/lib/db/queries";
import type { AdminUser } from "@/lib/db/schema";
import { StatCard } from "@/components/admin/StatCard";
import { EmptyState } from "@/components/admin/EmptyState";
import { currentYearMonthZagreb, dateStringOffsetFromTodayZagreb, greetingZagreb, todayDateStringZagreb } from "@/lib/date";
import OwnerHero from "@/components/admin/OwnerHero";
import OwnerTrendChart from "@/components/admin/OwnerTrendChart";
import OwnerPropertyCarousel from "@/components/admin/OwnerPropertyCarousel";
import OwnerMiniCalendar from "@/components/admin/OwnerMiniCalendar";
import OwnerShareReport from "@/components/admin/OwnerShareReport";

export default async function AdminDashboard() {
  // Prije se ovdje zvao requireFullAdmin() koji je vlasnika (role="owner")
  // odmah preusmjeravao na /admin/inquiries — sad /admin grana na
  // OwnerDashboard umjesto preusmjeravanja, pa loginAction vlasnika šalje
  // ovamo (vidi lib/actions.ts loginAction).
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (admin.role === "owner") return <OwnerDashboard admin={admin} />;

  const [properties, companies, studies, products, nfcTags, unreadInquiries, subscriptionStats] = await Promise.all([
    listProperties(),
    listCompanies(),
    listStudies(),
    listProducts(),
    listNfcTags(),
    countUnreadInquiries(),
    // Financije brojke su vidljive samo glavnom adminu (isti gate kao
    // /admin/financije) — "obični" puni admini ne trebaju vidjeti NOVO-ovu
    // vlastitu naplatu klijentima na naslovnici.
    admin.isSuperAdmin ? getSubscriptionStats() : Promise.resolve(null),
  ]);
  const publishedCount = properties.filter((p) => p.published).length;
  const inStudiesCount = properties.filter((p) => p.showInStudies).length;

  // Zarada ovaj mjesec preko SVIH vikendica — isti izračun kao vlasnički
  // dashboard i /admin/rezervacije (checkIn-mjesec, samo plaćene rezervacije,
  // vidi lib/db/queries getMonthlyEarnings). "Ovaj mjesec" po hrvatskom
  // vremenu (Europe/Zagreb), ne po UTC serverskom vremenu.
  const nowZagreb = currentYearMonthZagreb();
  const monthPrefix = `${nowZagreb.year}-${String(nowZagreb.month).padStart(2, "0")}`;
  const earnings = await getMonthlyEarnings(properties.map((p) => p.id), monthPrefix);

  return (
    <div className="flex flex-col gap-12">
      {unreadInquiries > 0 && (
        <Link
          href="/admin/inquiries"
          className="flex items-center justify-between border border-[#ff7f00]/40 bg-[#ff7f00]/5 rounded-xl px-4 py-3 hover:border-[#ff7f00]"
        >
          <span className="text-sm font-semibold">
            {unreadInquiries} {unreadInquiries === 1 ? "novi upit čeka" : "novih upita čeka"}
          </span>
          <span className="text-sm text-[#b35600] font-semibold">Pogledaj →</span>
        </Link>
      )}

      {subscriptionStats && subscriptionStats.expiringSoonCount > 0 && (
        <Link
          href="/admin/financije"
          className="flex items-center justify-between border border-red-300 bg-red-50 rounded-xl px-4 py-3 hover:border-red-400"
        >
          <span className="text-sm font-semibold">
            {subscriptionStats.expiringSoonCount} pretplata ističe uskoro
          </span>
          <span className="text-sm text-red-600 font-semibold">Financije →</span>
        </Link>
      )}

      <section className="admin-animate-grid grid grid-cols-2 sm:grid-cols-7 gap-3">
        <StatCard label="Vikendice" value={properties.length} />
        <StatCard label="Objavljeno" value={publishedCount} />
        <StatCard label="U Studies popisu" value={inStudiesCount} />
        <StatCard label="Firme" value={companies.length} />
        <StatCard label="Studies unosi" value={studies.length} />
        <StatCard label="Proizvodi" value={products.length} />
        <StatCard label="NFC oznake" value={nfcTags.length} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Zarada ovaj mjesec — sve vikendice
          </h2>
          <Link href="/admin/vikendice" className="text-xs font-semibold text-[#b35600]">
            Vikendice →
          </Link>
        </div>
        <div className="admin-animate-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Naplaćeno (bruto)" value={earnings.grossEur} suffix=" €" />
          <StatCard label="Troškovi" value={earnings.expensesEur} suffix=" €" />
          <StatCard label="Neto zarada" value={earnings.netEur} suffix=" €" />
        </div>
      </section>

      {subscriptionStats && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
              NOVO pretplate klijenata
            </h2>
            <Link href="/admin/financije" className="text-xs font-semibold text-[#b35600]">
              Financije →
            </Link>
          </div>
          <div className="admin-animate-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label={subscriptionStats.trialMrrEur > 0 ? `MRR (+${subscriptionStats.trialMrrEur} € nakon probnih)` : "MRR (mjesečno)"} value={subscriptionStats.mrrEur} suffix=" €" />
            <StatCard label="Aktivne pretplate" value={subscriptionStats.activeCount} />
            <StatCard label="Na probnom periodu" value={subscriptionStats.trialCount} />
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40 mb-3">
          Brze radnje
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/properties/new" className="admin-quicklink">
            + Nova vikendica
          </Link>
          <Link href="/admin/companies/new" className="admin-quicklink">
            + Nova firma
          </Link>
          <Link href="/admin/studies/new" className="admin-quicklink">
            + Novi Study
          </Link>
          <Link href="/admin/products/new" className="admin-quicklink">
            + Novi proizvod
          </Link>
          <Link href="/admin/nfc/new" className="admin-quicklink">
            + Nova NFC oznaka
          </Link>
          <Link href="/admin/agency" className="admin-quicklink">
            Sadržaj agencije
          </Link>
          <Link href="/admin/vikendice" className="admin-quicklink">
            Vikendice
          </Link>
          {/* Prodaja je spojena u Financije (na izričit zahtjev korisnika),
              pa više nema svoj zaseban quicklink — vidi app/admin/financije. */}
          {admin.isSuperAdmin && (
            <Link href="/admin/financije" className="admin-quicklink">
              Financije
            </Link>
          )}
          <Link href="/admin/inquiries" className="admin-quicklink">
            Svi upiti
          </Link>
          {admin.isSuperAdmin && (
            <Link href="/admin/admins" className="admin-quicklink">
              Upravljaj adminima
            </Link>
          )}
          <Link href="/" target="_blank" className="admin-quicklink">
            Pogledaj stranicu ↗
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Vikendice</h1>
          <Link
            href="/admin/properties/new"
            className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2"
          >
            + Dodaj vikendicu
          </Link>
        </div>

        {properties.length === 0 ? (
          <EmptyState title="Još nema vikendica" hint="Klikni „Dodaj vikendicu” da napraviš prvu." />
        ) : (
          <div className="flex flex-col gap-2">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/admin/properties/${p.id}`}
                className="flex items-center justify-between neu-card neu-card-interactive px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    novo.hr/{p.slug} · {p.location} · {p.layoutStyle}
                    {p.darkMode ? " · dark" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.showInStudies && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0000c3]/10 text-[#0000c3]">
                      u studies
                    </span>
                  )}
                  <span
                    className={
                      "text-xs font-semibold px-2.5 py-1 rounded-full " +
                      (p.published
                        ? "bg-green-100 text-green-700"
                        : "bg-black/5 text-black/50")
                    }
                  >
                    {p.published ? "objavljeno" : "skriveno"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="firme">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Firme</h1>
            <p className="text-xs text-black/50 mt-0.5">
              Pune vlastite stranice za firme/obrte — isti princip kao vikendice (galerija,
              recenzije, poddomena i vlastita domena), bez booking polja.
            </p>
          </div>
          <Link
            href="/admin/companies/new"
            className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 shrink-0"
          >
            + Dodaj firmu
          </Link>
        </div>

        {companies.length === 0 ? (
          <EmptyState title="Još nema firmi" hint="Klikni „Dodaj firmu” da napraviš prvu." />
        ) : (
          <div className="flex flex-col gap-2">
            {companies.map((c) => (
              <Link
                key={c.id}
                href={`/admin/companies/${c.id}`}
                className="flex items-center justify-between neu-card neu-card-interactive px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    probajnovo.vercel.app/{c.slug} · {c.location} · {c.layoutStyle}
                    {c.darkMode ? " · dark" : ""}
                  </div>
                </div>
                <span
                  className={
                    "text-xs font-semibold px-2.5 py-1 rounded-full " +
                    (c.published ? "bg-green-100 text-green-700" : "bg-black/5 text-black/50")
                  }
                >
                  {c.published ? "objavljeno" : "skriveno"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Studies</h1>
            <p className="text-xs text-black/50 mt-0.5">
              Opći portfolio unosi (brend identitet, digitalni dizajn, film…) — prikazuju se
              u STUDIES popisu na naslovnici, bez vlastite stranice.
            </p>
          </div>
          <Link
            href="/admin/studies/new"
            className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 shrink-0"
          >
            + Dodaj Study
          </Link>
        </div>

        {studies.length === 0 ? (
          <EmptyState title="Još nema Studies unosa" hint="Klikni „Dodaj Study” da napraviš prvi." />
        ) : (
          <div className="flex flex-col gap-2">
            {studies.map((s) => (
              <Link
                key={s.id}
                href={`/admin/studies/${s.id}`}
                className="flex items-center justify-between neu-card neu-card-interactive px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-sm">{s.title}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    {s.category} · {s.year}
                  </div>
                </div>
                <span
                  className={
                    "text-xs font-semibold px-2.5 py-1 rounded-full " +
                    (s.published
                      ? "bg-green-100 text-green-700"
                      : "bg-black/5 text-black/50")
                  }
                >
                  {s.published ? "objavljeno" : "skriveno"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Proizvodi</h1>
            <p className="text-xs text-black/50 mt-0.5">
              Fizički proizvodi (npr. 3D printane pločice s NFC oznakama) — prikazuju se u
              PROIZVODI popisu na naslovnici. Bez online plaćanja, posjetitelj šalje upit mailom.
            </p>
          </div>
          <Link
            href="/admin/products/new"
            className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 shrink-0"
          >
            + Dodaj proizvod
          </Link>
        </div>

        {products.length === 0 ? (
          <EmptyState title="Još nema proizvoda" hint="Klikni „Dodaj proizvod” da napraviš prvi." />
        ) : (
          <div className="flex flex-col gap-2">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}`}
                className="flex items-center justify-between neu-card neu-card-interactive px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {p.name}
                    {p.featured && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-[#ff7f00]/15 text-[#b35600] px-2 py-0.5 rounded-full">
                        Istaknuto
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-black/50 mt-0.5">
                    {p.priceEur != null ? `od ${p.priceEur} €` : "na upit"}
                    {p.slug && <> · /proizvodi/{p.slug}</>}
                </div>
              </div>
              <span
                className={
                  "text-xs font-semibold px-2.5 py-1 rounded-full " +
                  (p.published
                    ? "bg-green-100 text-green-700"
                    : "bg-black/5 text-black/50")
                }
              >
                {p.published ? "objavljeno" : "skriveno"}
              </span>
            </Link>
          ))}
        </div>
      )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">NFC oznake</h1>
            <p className="text-xs text-black/50 mt-0.5">
              Gost-facing WiFi stranica za svaku fizičku NFC pločicu — dodirom telefona gost
              vidi mrežu/lozinku (+ QR za auto-spajanje) i opcionalnu dobrodošlicu.
            </p>
          </div>
          <Link
            href="/admin/nfc/new"
            className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 shrink-0"
          >
            + Dodaj NFC oznaku
          </Link>
        </div>

        {nfcTags.length === 0 ? (
          <EmptyState title="Još nema NFC oznaka" hint="Klikni „Dodaj NFC oznaku” da napraviš prvu." />
        ) : (
          <div className="flex flex-col gap-2">
            {nfcTags.map((tag) => (
              <Link
                key={tag.id}
                href={`/admin/nfc/${tag.id}`}
                className="flex items-center justify-between neu-card neu-card-interactive px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-sm">{tag.label}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    probajnovo.com/nfc/{tag.slug} · {tag.wifiSsid}
                  </div>
                </div>
                <span
                  className={
                    "text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 " +
                    (tag.published
                      ? "bg-green-100 text-green-700"
                      : "bg-black/5 text-black/50")
                  }
                >
                  {tag.published ? "objavljeno" : "skriveno"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Vlasnički (role="owner") dashboard — NOVO/Revolut redizajn: velika */
/* hero kartica (neto zarada, cilj dana zauzeća s prstenom), dva      */
/* animirana trend grafa (zarada i zauzetost zadnjih 6 mjeseci) i,    */
/* ako vlasnik ima više od jedne vikendice, vodoravni red kartica po  */
/* vikendici. Gamifikacija (Duolingo-stil streak, bedževi/postignuća) */
/* je UKLONJENA na izričit zahtjev ("achievementi nisu potrebni, sve  */
/* beskorisne stvari izbaci") — vidi OwnerHero.tsx i obrisan          */
/* components/admin/OwnerBadges.tsx. Vlasnik i dalje ne smije ništa   */
/* uređivati ovdje — samo grafovi i linkovi na /admin/kalendar,       */
/* /admin/rezervacije i /admin/inquiries,                             */
/* gdje se sva stvarna radnja događa. Superadmin dashboard iznad ovoga */
/* (AdminDashboard) namjerno NIJE dirat — redizajn je isključivo za   */
/* role "owner", po izričitom zahtjevu.                               */
/* ---------------------------------------------------------------- */

const OWNER_MONTH_NAMES_HR = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];

async function OwnerDashboard({ admin }: { admin: AdminUser }) {
  const [properties, companies, inquiries] = await Promise.all([
    listPropertiesForAdmin(admin),
    listCompaniesForAdmin(admin),
    listInquiriesForAdmin(admin),
  ]);

  // Ime domaćina za pozdrav — izvučeno iz property.hostName prve dodijeljene
  // vikendice koja ga ima postavljenog (vlasnik firme, bez vikendice, nema
  // hostName polje pa pozdrav ostaje generički).
  const hostName = properties.find((p) => p.hostName)?.hostName ?? null;

  const pendingCount = inquiries.filter((i) => !i.read).length;
  const recentInquiries = inquiries.slice(0, 3); // listInquiries već sortira desc(createdAt)

  const nowZagreb = currentYearMonthZagreb();
  const monthPrefix = `${nowZagreb.year}-${String(nowZagreb.month).padStart(2, "0")}`;
  // MiniCalendar niže samo čita .getFullYear()/.getMonth() iz ovog objekta pa
  // ga gradimo preko Date.UTC iz Zagreb godine/mjeseca — golo `new Date()` bi
  // oko ponoći opet vratilo UTC (server) mjesec, ne hrvatski.
  const now = new Date(Date.UTC(nowZagreb.year, nowZagreb.month - 1, 1));
  const propertyIds = properties.map((p) => p.id);

  const weekAgo = dateStringOffsetFromTodayZagreb(-7);
  const [blockedByProperty, trend, breakdown, reservationsByProperty, viewsThisWeek] = await Promise.all([
    Promise.all(properties.map((p) => listBlockedDates(p.id))),
    // 13 mjeseci: zadnjih 6 za trend graf ispod, + trend[0] je isti mjesec
    // prošle godine za usporedbu u hero kartici (vidi getOwnerMonthlyTrend).
    getOwnerMonthlyTrend(propertyIds, 13),
    properties.length > 1
      ? getPropertiesMonthlyBreakdown(propertyIds, monthPrefix)
      : Promise.resolve({} as Record<number, { daysBooked: number; netEur: number }>),
    Promise.all(properties.map((p) => listReservationsForProperty(p.id))),
    countPageViewsSince(
      [
        { source: "property", ids: propertyIds },
        { source: "company", ids: companies.map((c) => c.id) },
      ],
      weekAgo
    ).catch(() => 0),
  ]);

  // Plan #41: "što je danas važno" — dolasci danas/sutra i upiti bez odgovora.
  const todayStr = todayDateStringZagreb();
  const tomorrowStr = dateStringOffsetFromTodayZagreb(1);
  const allReservations = reservationsByProperty.flat();
  const arrivalsToday = allReservations.filter((r) => r.checkIn === todayStr);
  const arrivalsTomorrow = allReservations.filter((r) => r.checkIn === tomorrowStr);
  const unanswered = inquiries.filter((i) => !i.replied).length;
  const inquiriesThisWeek = inquiries.filter(
    (i) => new Date(i.createdAt).toISOString().slice(0, 10) >= weekAgo
  ).length;
  const todayLines: string[] = [];
  const namesOf = (list: typeof allReservations) =>
    list.length === 1 ? list[0].guestName : `${list.length} gosta`;
  if (arrivalsToday.length > 0) todayLines.push(`Danas dolazi ${namesOf(arrivalsToday)}.`);
  if (arrivalsTomorrow.length > 0) todayLines.push(`Sutra dolazi ${namesOf(arrivalsTomorrow)}.`);
  if (unanswered > 0)
    todayLines.push(
      unanswered === 1 ? "1 upit čeka odgovor." : `${unanswered} upita čeka odgovor.`
    );
  const displayName = admin.displayName?.trim() || hostName;
  const firstName = displayName ? displayName.split(/\s+/)[0] : null;
  // Zbroj zauzetih dana preko SVIH dodijeljenih vikendica ovaj mjesec (ne
  // unique po datumu) — ako vlasnik ima dvije vikendice, svaka se broji
  // zasebno, jer je ovo "koliko je noćenja zauzeto", ne "koliko dana u
  // kalendaru postoji".
  const daysBookedThisMonth = blockedByProperty
    .flat()
    .filter((b) => b.date.startsWith(monthPrefix)).length;

  const currentMonthPoint = trend[trend.length - 1] ?? null;
  const netEurThisMonth = currentMonthPoint?.netEur ?? 0;
  const prevMonthPoint = trend.length >= 2 ? trend[trend.length - 2] : null;
  const deltaPct =
    prevMonthPoint && prevMonthPoint.netEur !== 0
      ? Math.round(((netEurThisMonth - prevMonthPoint.netEur) / Math.abs(prevMonthPoint.netEur)) * 100)
      : null;
  // "Najbolji mjesec ikad" — samo ako imamo bar jedan raniji mjesec za
  // usporedbu i ovaj mjesec stvarno nadmašuje sve prethodne (uključujući
  // mjesece bez podataka, koji broje kao 0 — pa prvi mjesec sa stvarnom
  // zaradom prirodno postaje "rekord" i to je uredu, vrijedi proslaviti).
  const historicalNets = trend.slice(0, -1).map((t) => t.netEur);
  const isRecord = netEurThisMonth > 0 && historicalNets.length > 0 && netEurThisMonth > Math.max(...historicalNets);
  // trend[0] je, uz monthsBack=13, isti mjesec prošle godine — YoY usporedba
  // ima smisla samo kada imamo punih 13 točaka (dovoljno dug povijesni niz).
  const yoyDeltaDays = trend.length >= 13 ? daysBookedThisMonth - trend[0].daysBooked : null;

  // Dana u tekućem mjesecu (Date.UTC(year, month, 0) s mjesecom 1-12 vraća
  // zadnji dan TOG mjeseca, jer se "month" tumači kao 0-indeksirani mjesec
  // + 1 pa dan 0 vrati na zadnji dan traženog mjeseca).
  const daysInCurrentMonth = new Date(Date.UTC(nowZagreb.year, nowZagreb.month, 0)).getUTCDate();
  const autoGoalDays = Math.max(5, Math.round(daysInCurrentMonth * 0.7));

  const recentTrend = trend.slice(-6);

  const miniCalProperties = properties.map((p, i) => ({
    id: p.id,
    name: p.name,
    blocked: (blockedByProperty[i] ?? []).map((b) => ({ date: b.date, source: b.source })),
  }));
  const pageCount = properties.length + companies.length;
  const singleName = pageCount === 1 ? (properties[0]?.name ?? companies[0]?.name ?? null) : null;
  const monthLabel = `${OWNER_MONTH_NAMES_HR[nowZagreb.month - 1]} ${nowZagreb.year}`;
  const effectiveGoalDays = admin.customGoalDays ?? autoGoalDays;

  return (
    // Redizajn (Faza 3, na izričit zahtjev "lijep i pregledan... ne treba
    // biti sve u sredini, nego nek se rasporedi fino preko cijelog ekrana"):
    // .admin-breakout izbija iz dijeljenog max-w-4xl <main> (app/admin/
    // layout.tsx, koji omata svih 28 admin stranica pa se ne mijenja
    // globalno), .admin-breakout-inner onda sam sebe centrira do razumne
    // maksimalne širine (vidi opsežan komentar uz te dvije klase u
    // globals.css). Sadržaj ispod je isti (ista djeca, ISTI podaci) samo
    // PREGRUPIRAN u dvostupčane retke na širem zaslonu (hero+bedževi/
    // kalendar jedan pored drugog, upiti+brze radnje jedan pored drugog)
    // umjesto jedne duge vertikalne trake — na mobitelu se sve svejedno
    // slaže natrag u jedan stupac (lg: prefiksi).
    <div className="admin-breakout">
      <div
        className="admin-breakout-inner owner-dash flex flex-col gap-6"
        data-theme={admin.themePreference ?? "system"}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">
              {greetingZagreb()}
              {firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--od-ink-soft)" }}>
              {pageCount === 0
                ? "Nemaš dodijeljenu nijednu vikendicu ili firmu — javi se glavnom adminu."
                : todayLines.length > 0
                  ? todayLines.join(" ")
                  : singleName
                    ? `Danas nema dolazaka ni upita koji čekaju — ${singleName} je pod kontrolom.`
                    : "Danas nema dolazaka ni upita koji čekaju."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {properties.length > 0 && (
              <OwnerShareReport
                stats={{
                  monthLabel,
                  subtitle: singleName,
                  netEur: netEurThisMonth,
                  currentDays: daysBookedThisMonth,
                  goalDays: effectiveGoalDays,
                  deltaPct,
                  isRecord,
                }}
              />
            )}
          </div>
        </div>

        {properties.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-5 items-start">
            <OwnerHero
              monthLabel={monthLabel}
              netEur={netEurThisMonth}
              deltaPct={deltaPct}
              isRecord={isRecord}
              autoGoalDays={autoGoalDays}
              initialCustomGoalDays={admin.customGoalDays}
              currentDays={daysBookedThisMonth}
              yoyDeltaDays={yoyDeltaDays}
            />
            <div className="flex flex-col gap-5">
              {miniCalProperties.length > 0 && <OwnerMiniCalendar properties={miniCalProperties} now={now} />}
            </div>
          </div>
        )}


        {pageCount > 0 && (
          <section className="flex flex-col gap-2.5">
            {/* Zarada je već velika u kartici gore, pa je treća pločica
                posjete stranice (plan #43) — dokaz da se stranica isplati. */}
            <div className="admin-animate-grid grid grid-cols-3 gap-3 sm:gap-4">
              <OwnerStatCard label={pendingCount === 1 ? "Novi upit" : "Novih upita"} value={pendingCount} accent="orange" />
              <OwnerStatCard label="Dana zauzeto ovaj mjesec" value={daysBookedThisMonth} accent="navy" />
              <OwnerStatCard label="Posjeta stranice (7 dana)" value={viewsThisWeek} accent="purple" />
            </div>
            <p className="text-sm" style={{ color: "var(--od-ink-soft)" }}>
              {viewsThisWeek > 0
                ? `Tvoju stranicu je ovaj tjedan pogledalo ${viewsThisWeek.toLocaleString("hr-HR")} ${viewsThisWeek === 1 ? "posjetitelj" : "posjetitelja"}${inquiriesThisWeek > 0 ? `, a ${inquiriesThisWeek} ${inquiriesThisWeek === 1 ? "upit je stigao" : "upita je stiglo"} u istom razdoblju` : ""}.`
                : inquiriesThisWeek > 0
                  ? `Ovaj tjedan ${inquiriesThisWeek === 1 ? "stigao je 1 upit" : `stiglo je ${inquiriesThisWeek} upita`}. Posjete brojimo od prvog otvaranja stranice.`
                  : "Ovaj tjedan još nema posjeta ni upita."}
            </p>
          </section>
        )}

        {properties.length > 0 && recentTrend.length > 1 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OwnerTrendChart
              title="Zarada — zadnjih 6 mjeseci"
              labels={recentTrend.map((t) => t.monthLabel)}
              data={recentTrend.map((t) => t.netEur)}
              suffix=" €"
              color="#0000c3"
            />
            <OwnerTrendChart
              title="Dana zauzeto — zadnjih 6 mjeseci"
              labels={recentTrend.map((t) => t.monthLabel)}
              data={recentTrend.map((t) => t.daysBooked)}
              suffix=" dana"
              color="#ff7f00"
            />
          </section>
        )}

        {properties.length > 1 && (
          <OwnerPropertyCarousel properties={properties} breakdown={breakdown} monthLabel={monthLabel} />
        )}

        {pageCount > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--od-ink-faint)" }}>
                  Zadnji upiti
                </h2>
                <Link href="/admin/inquiries" className="text-xs font-semibold text-[#b35600]">
                  Svi upiti →
                </Link>
              </div>
              {recentInquiries.length === 0 ? (
                <EmptyState title="Još nema upita" />
              ) : (
                <div className="flex flex-col gap-2">
                  {recentInquiries.map((i) => (
                    <Link
                      key={i.id}
                      href="/admin/inquiries"
                      className="owner-glass owner-glass-interactive flex items-center justify-between rounded-xl px-4 py-3"
                    >
                      <div>
                        <div className="font-semibold text-sm" style={{ color: "var(--od-ink)" }}>
                          {i.name}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--od-ink-faint)" }}>
                          {i.sourceName} · {new Date(i.createdAt).toLocaleDateString("hr-HR")}
                        </div>
                      </div>
                      {!i.read && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ff7f00]/10 text-[#b35600] shrink-0">
                          novo
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--od-ink-faint)" }}>
                Brze radnje
              </h2>
              <div className="flex flex-wrap lg:flex-col gap-2">
                <Link href="/admin/rezervacije" className="owner-quicklink">
                  Rezervacije
                </Link>
                <Link href="/admin/kalendar" className="owner-quicklink">
                  Kalendar
                </Link>
                <Link href="/admin/inquiries" className="owner-quicklink">
                  Svi upiti
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** Vlasnički pandan StatCard-u iznad — NAMJERNO odvojena funkcija (ne dijeli
    se s AdminDashboard/StatCard) da glass redizajn ostane izoliran na
    role="owner", isti razlog kao .owner-quicklink u globals.css. */
function OwnerStatCard({
  label,
  value,
  suffix,
  accent = "navy",
}: {
  label: string;
  value: number;
  suffix?: string;
  /** Tanka gradient traka na vrhu kartice — daje svakoj kartici vlastiti
      identitet umjesto tri identične sive pločice (vidi globals.css
      .owner-stat-card-*). */
  accent?: "navy" | "orange" | "purple";
}) {
  return (
    <div className={`owner-glass owner-glass-grain owner-stat-card owner-stat-card-${accent} rounded-2xl px-3 py-3 sm:px-4`}>
      <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--od-ink)" }}>
        {value.toLocaleString("hr-HR")}
        {suffix ?? ""}
      </div>
      <div className="text-xs mt-0.5 leading-snug" style={{ color: "var(--od-ink-soft)" }}>
        {label}
      </div>
    </div>
  );
}
