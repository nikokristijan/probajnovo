import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  listProperties,
  listCompanies,
  listStudies,
  listProducts,
  countUnreadInquiries,
  listPropertiesForAdmin,
  listCompaniesForAdmin,
  listInquiriesForAdmin,
  listBlockedDates,
  getMonthlyEarnings,
} from "@/lib/db/queries";
import type { AdminUser } from "@/lib/db/schema";
import { currentYearMonthZagreb } from "@/lib/date";
import MiniCalendar from "@/components/admin/MiniCalendar";

export default async function AdminDashboard() {
  // Prije se ovdje zvao requireFullAdmin() koji je vlasnika (role="owner")
  // odmah preusmjeravao na /admin/inquiries — sad /admin grana na
  // OwnerDashboard umjesto preusmjeravanja, pa loginAction vlasnika šalje
  // ovamo (vidi lib/actions.ts loginAction).
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (admin.role === "owner") return <OwnerDashboard admin={admin} />;

  const [properties, companies, studies, products, unreadInquiries] = await Promise.all([
    listProperties(),
    listCompanies(),
    listStudies(),
    listProducts(),
    countUnreadInquiries(),
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
          <span className="text-sm text-[#ff7f00] font-semibold">Pogledaj →</span>
        </Link>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <StatCard label="Vikendice" value={properties.length} />
        <StatCard label="Objavljeno" value={publishedCount} />
        <StatCard label="U Studies popisu" value={inStudiesCount} />
        <StatCard label="Firme" value={companies.length} />
        <StatCard label="Studies unosi" value={studies.length} />
        <StatCard label="Proizvodi" value={products.length} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Zarada ovaj mjesec — sve vikendice
          </h2>
          <Link href="/admin/vikendice" className="text-xs font-semibold text-[#ff7f00]">
            Vikendice →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Naplaćeno (bruto)" value={earnings.grossEur} suffix=" €" />
          <StatCard label="Troškovi" value={earnings.expensesEur} suffix=" €" />
          <StatCard label="Neto zarada" value={earnings.netEur} suffix=" €" />
        </div>
      </section>

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
          <Link href="/admin/agency" className="admin-quicklink">
            Sadržaj agencije
          </Link>
          <Link href="/admin/vikendice" className="admin-quicklink">
            Vikendice
          </Link>
          <Link href="/admin/prodaja" className="admin-quicklink">
            Prodaja
          </Link>
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
          <p className="text-sm text-black/60">
            Još nema dodanih vikendica. Klikni &ldquo;Dodaj vikendicu&rdquo; da napraviš prvu.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/admin/properties/${p.id}`}
                className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 bg-white hover:border-[#0000c3]/40"
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
          <p className="text-sm text-black/60">
            Još nema dodanih firmi. Klikni &ldquo;Dodaj firmu&rdquo; da napraviš prvu.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {companies.map((c) => (
              <Link
                key={c.id}
                href={`/admin/companies/${c.id}`}
                className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 bg-white hover:border-[#0000c3]/40"
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
          <p className="text-sm text-black/60">
            Još nema dodanih Studies unosa. Klikni &ldquo;Dodaj Study&rdquo; da napraviš prvi.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {studies.map((s) => (
              <Link
                key={s.id}
                href={`/admin/studies/${s.id}`}
                className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 bg-white hover:border-[#0000c3]/40"
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
          <p className="text-sm text-black/60">
            Još nema dodanih proizvoda. Klikni &ldquo;Dodaj proizvod&rdquo; da napraviš prvi.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}`}
                className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 bg-white hover:border-[#0000c3]/40"
              >
                <div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    {p.priceEur != null ? `od ${p.priceEur} €` : "na upit"}
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
    </div>
  );
}

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

/* ---------------------------------------------------------------- */
/* Vlasnički (role="owner") dashboard — zamjena za stari redirect na  */
/* /admin/inquiries: pozdrav imenom domaćina (property.hostName),     */
/* brzi pregled (novi upiti, dana zauzeto ovaj mjesec), mini kalendar */
/* prve dodijeljene vikendice i zadnja 3 upita. Vlasnik i dalje ne    */
/* smije ništa uređivati ovdje — samo linkovi na /admin/kalendar i    */
/* /admin/inquiries, gdje se sva stvarna radnja događa.               */
/* ---------------------------------------------------------------- */

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
  const [blockedByProperty, earnings] = await Promise.all([
    Promise.all(properties.map((p) => listBlockedDates(p.id))),
    getMonthlyEarnings(properties.map((p) => p.id), monthPrefix),
  ]);
  // Zbroj zauzetih dana preko SVIH dodijeljenih vikendica ovaj mjesec (ne
  // unique po datumu) — ako vlasnik ima dvije vikendice, svaka se broji
  // zasebno, jer je ovo "koliko je noćenja zauzeto", ne "koliko dana u
  // kalendaru postoji".
  const daysBookedThisMonth = blockedByProperty
    .flat()
    .filter((b) => b.date.startsWith(monthPrefix)).length;

  const firstProperty = properties[0] ?? null;
  const pageCount = properties.length + companies.length;
  const singleName = pageCount === 1 ? (properties[0]?.name ?? companies[0]?.name ?? null) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold">Pozdrav{hostName ? `, ${hostName}` : ""}!</h1>
        <p className="text-sm text-black/50 mt-1">
          {pageCount === 0
            ? "Nemaš dodijeljenu nijednu vikendicu ili firmu — javi se glavnom adminu."
            : singleName
              ? `Pregled za ${singleName}.`
              : "Pregled tvojih dodijeljenih stranica."}
        </p>
      </div>

      {pageCount > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label={pendingCount === 1 ? "Novi upit" : "Novih upita"} value={pendingCount} />
          <StatCard label="Dana zauzeto ovaj mjesec" value={daysBookedThisMonth} />
          <StatCard label="Zarada ovaj mjesec (neto)" value={earnings.netEur} suffix=" €" />
        </section>
      )}

      {firstProperty && <MiniCalendar propertyId={firstProperty.id} propertyName={firstProperty.name} blocked={blockedByProperty[0] ?? []} now={now} />}

      {pageCount > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Zadnji upiti
            </h2>
            <Link href="/admin/inquiries" className="text-xs font-semibold text-[#ff7f00]">
              Svi upiti →
            </Link>
          </div>
          {recentInquiries.length === 0 ? (
            <p className="text-sm text-black/60">Još nema upita.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentInquiries.map((i) => (
                <Link
                  key={i.id}
                  href="/admin/inquiries"
                  className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 bg-white hover:border-[#ff7f00]/40"
                >
                  <div>
                    <div className="font-semibold text-sm">{i.name}</div>
                    <div className="text-xs text-black/50 mt-0.5">
                      {i.sourceName} · {new Date(i.createdAt).toLocaleDateString("hr-HR")}
                    </div>
                  </div>
                  {!i.read && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ff7f00]/10 text-[#ff7f00] shrink-0">
                      novo
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {pageCount > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40 mb-3">
            Brze radnje
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/rezervacije" className="admin-quicklink">
              Rezervacije
            </Link>
            <Link href="/admin/kalendar" className="admin-quicklink">
              Kalendar
            </Link>
            <Link href="/admin/inquiries" className="admin-quicklink">
              Svi upiti
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

