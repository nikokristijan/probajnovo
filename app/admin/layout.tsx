import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getCurrentAdminRecord } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { listPropertiesForAdmin, listCompaniesForAdmin } from "@/lib/db/queries";
import PwaRegister from "@/components/admin/PwaRegister";
import PresenceHeartbeat from "@/components/admin/PresenceHeartbeat";
import AdminNavLink from "@/components/admin/AdminNavLink";
import { MenuIcon, LogOutIcon, ExternalLinkIcon } from "@/components/admin/Icons";

/* OSMI krug feedbacka ("vrh je oštra kocka, bijelo gore i dole", potvrđeno
   da je admin dodan na početni zaslon kao PWA) — statusBarStyle "default"
   je STATIČAN i uvijek daje bijelu iOS statusnu traku (sat/baterija), bez
   obzira na vlasnikovu tamnu temu; ta traka NIJE dio našeg DOM-a (OS je
   crta preko nje), pa je nijedan CSS unutar stranice ne može obojiti — samo
   ovaj meta podatak. Zato metadata mora postati generateMetadata(): čita
   trenutnog admina i za role="owner" u eksplicitnoj tamnoj temi vraća
   "black" (puna tamna traka, sljubljuje se s .neu-header ispod umjesto
   bijelog reza) — za sve ostalo (puni/superadmin, ili vlasnik u
   svijetloj/sustavnoj temi) ostaje "default" kao i dosad, potpuno
   nepromijenjeno ponašanje na tom putu. "Sustav" tema nema poseban slučaj
   jer OS preferenciju ne možemo pročitati na serveru u ovoj točki — ostaje
   "default", isto kao prije ovog popravka (bez regresije). */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getCurrentAdminRecord();
  const ownerDark = admin?.role === "owner" && admin.themePreference === "dark";
  return {
    title: "NOVO — admin",
    robots: { index: false, follow: false },
    // PWA — omogućuje "Dodaj na početni zaslon" / "Instaliraj aplikaciju" za
    // /admin na mobitelu, vidi public/admin-manifest.json i PwaRegister.tsx.
    manifest: "/admin-manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: ownerDark ? "black" : "default",
      title: "NOVO admin",
    },
    icons: {
      apple: "/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#ff7f00",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdminRecord();

  // Za vlasnika prikazujemo koju vikendicu/firmu upravlja odmah uz "vlasnik"
  // značku u headeru (npr. "vlasnik · Sokak bez imena") — bez ovoga admin
  // izgleda identično kome god bio dodijeljen, pa nije jasno na prvi pogled
  // kojom stranicom vlasnik zapravo upravlja.
  let ownerLabel: string | null = null;
  // "Pogledaj stranicu" u headeru dolje treba vlasnika odvesti na NJEGOVU
  // vikendicu/firmu, ne na agencijsku naslovnicu (koja njemu ništa ne znači
  // i nije njegova stranica) — prva dodijeljena vikendica ima prednost,
  // firma tek ako vlasnik nema nijednu vikendicu. Null = vlasnik nema
  // dodijeljenu nijednu stranicu, pa link ostaje na agencijskoj naslovnici.
  let ownerPageHref: string | null = null;
  if (admin?.role === "owner") {
    const [ownedProperties, ownedCompanies] = await Promise.all([
      listPropertiesForAdmin(admin),
      listCompaniesForAdmin(admin),
    ]);
    const names = [...ownedProperties.map((p) => p.name), ...ownedCompanies.map((c) => c.name)];
    ownerLabel = names.length > 0 ? names.join(", ") : null;
    const slug = ownedProperties[0]?.slug ?? ownedCompanies[0]?.slug;
    ownerPageHref = slug ? `/${slug}` : null;
  }

  // "owner-page-bg" + data-theme dolje SAMO za role="owner" (vidi opsežan
  // komentar uz .owner-page-bg u globals.css) — čini da .admin-shell-ova
  // pozadina odgovara vlasničkoj tamnoj/svijetloj temi umjesto fiksne sive,
  // da nestane oštar pravokutni rub oko .owner-dash kutije. Za punog
  // (super)admina ova dva propa su undefined, pa je .admin-shell izgled
  // identičan kao i prije — ništa se ne mijenja na tom putu.
  const isOwner = admin?.role === "owner";

  return (
    <div
      className={isOwner ? "admin-shell owner-page-bg" : "admin-shell"}
      data-theme={isOwner ? (admin.themePreference ?? "system") : undefined}
    >
      <PwaRegister />
      {/* "Ured" prisutnost (Faza 2, app/admin/poruke) — otkucaj svake minute
          dok je PUNI admin/superadmin bilo gdje u adminu, ne samo na
          /admin/poruke, da pikselizirani ured prati stvarnu aktivnost.
          Vlasnici namjerno isključeni (nisu dio agencijskog tima). */}
      {admin && admin.role !== "owner" && <PresenceHeartbeat />}
      {/* Neumorphism izbornik — ".neu-header"/".neu-nav"/".neu-btn"/".neu-toggle"
          (vidi opsežan komentar uz te klase u globals.css) zamjenjuju raniji
          par "owner-header staklo" vs "bg-white/border-black" jednim
          dijeljenim tretmanom za obje uloge; koja se paleta primijeni (light
          vlasnik / dark vlasnik / superadmin) ovisi samo o tome je li
          .owner-page-bg prisutan na omotaču gore, ne o ovom className-u. */}
      <header className="flex items-center justify-between px-6 py-4 neu-header flex-wrap gap-3">
        <span className="font-bold tracking-tight">
          NOVO <span className="text-[#ff7f00]">admin</span>
        </span>
        {admin && (
          <>
            {/* Čisto CSS "hamburger" (checkbox hack, bez klijentske komponente/JS-a) —
                s puno stavki u navu (do 9+ linkova za punog admina) na mobitelu se
                dosad samo ružno lomilo u više redaka preko flex-wrap; sad je iznad
                sm praga sakriveno iza gumba. Relevantno i jer admin panel već ima
                PWA "dodaj na početni zaslon" podršku (vidi PwaRegister gore), znači
                stvarno se koristi na mobitelu. */}
            <input type="checkbox" id="admin-nav-toggle" className="peer hidden" />
            <label
              htmlFor="admin-nav-toggle"
              className="sm:hidden neu-toggle px-3 py-1.5"
              aria-label="Izbornik"
            >
              <MenuIcon />
            </label>
            <nav className="hidden peer-checked:flex sm:flex items-start sm:items-center gap-3 sm:gap-5 text-sm flex-col sm:flex-row w-full sm:w-auto flex-wrap neu-nav">
            {admin.role === "owner" ? (
              // Vlasnik ima samo ograničen pregled — ne smije uređivati stranicu.
              // /admin sad prikazuje njegov vlastiti dashboard (vidi app/admin/page.tsx),
              // ne puni pregled kao za role="admin".
              <>
                <AdminNavLink href="/admin" exact>
                  Početna
                </AdminNavLink>
                <AdminNavLink href="/admin/inquiries">
                  Upiti
                </AdminNavLink>
                <AdminNavLink href="/admin/rezervacije">
                  Rezervacije
                </AdminNavLink>
                <AdminNavLink href="/admin/kalendar">
                  Kalendar
                </AdminNavLink>
              </>
            ) : (
              <>
                <AdminNavLink href="/admin" exact>
                  Pregled
                </AdminNavLink>
                <AdminNavLink href="/admin/agency">
                  Sadržaj agencije
                </AdminNavLink>
                <AdminNavLink href="/admin#firme">
                  Firme
                </AdminNavLink>
                {/* Kalendar/Rezervacije/Upiti su grupirani pod jedan hub (bira se
                    vikendica pa se tek onda vidi njen kalendar/rezervacije/upiti)
                    umjesto tri zasebna taba koja su miješala sve vikendice odjednom
                    i postajala krcata — vidi app/admin/vikendice. */}
                <AdminNavLink href="/admin/vikendice">
                  Vikendice
                </AdminNavLink>
                {/* Prodaja je spojena u Financije (na izričit zahtjev korisnika:
                    "spoji tab financije i prodaja u jedan") — jedan link, jedna
                    stranica, vidi app/admin/financije AgencyLedgerTable. */}
                {admin.isSuperAdmin && (
                  <AdminNavLink href="/admin/financije">
                    Financije
                  </AdminNavLink>
                )}
                <AdminNavLink href="/admin/aktivnost">
                  Aktivnost
                </AdminNavLink>
                {/* Tim/zadaci/poruke (Faza 2) — dostupno SVIM punim adminima i
                    superadminima, ne samo glavnom (na izričit zahtjev: "svi
                    puni admini + superadmini vide zadatke i poruke, dodjeljuju
                    ih jedni drugima"), za razliku od Financije/Admini ispod
                    koji ostaju samo za superadmina. */}
                <AdminNavLink href="/admin/zadaci">
                  Zadaci
                </AdminNavLink>
                <AdminNavLink href="/admin/poruke">
                  Poruke
                </AdminNavLink>
                {admin.isSuperAdmin && (
                  <AdminNavLink href="/admin/admins">
                    Admini
                  </AdminNavLink>
                )}
              </>
            )}
            <AdminNavLink href="/admin/settings">
              Postavke
            </AdminNavLink>
            {/* "Pogledaj stranicu" namjerno OSTAJE obični Link, ne AdminNavLink
                — vodi na javnu stranicu (druga domena/ruta), nije "sekcija"
                admina u kojoj se može "biti", pa aktivno stanje nema smisla. */}
            <Link href={ownerPageHref ?? "/"} target="_blank" className="inline-flex items-center gap-1">
              Pogledaj stranicu <ExternalLinkIcon />
            </Link>
            <span className="owner-header-faint flex items-center gap-1.5">
              {admin.email}
              {admin.isSuperAdmin && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ff7f00]/10 text-[#ff7f00]">
                  glavni
                </span>
              )}
              {admin.role === "owner" && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full owner-header-chip">
                  vlasnik{ownerLabel ? ` · ${ownerLabel}` : ""}
                </span>
              )}
            </span>
            <form action={logoutAction}>
              <button type="submit" className="neu-btn px-3 py-1.5">
                <LogOutIcon /> Odjava
              </button>
            </form>
            </nav>
          </>
        )}
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}

