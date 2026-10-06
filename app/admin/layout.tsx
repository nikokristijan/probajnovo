import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getCurrentAdminRecord } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import {
  listPropertiesForAdmin,
  listCompaniesForAdmin,
  countUnreadDirectMessages,
  getCommandPaletteItems,
} from "@/lib/db/queries";
import CommandPalette, { type PaletteItem } from "@/components/admin/CommandPalette";
import PwaRegister from "@/components/admin/PwaRegister";
import PresenceHeartbeat from "@/components/admin/PresenceHeartbeat";
import AdminNavLink from "@/components/admin/AdminNavLink";
import {
  MenuIcon,
  LogOutIcon,
  ExternalLinkIcon,
  HomeIcon,
  InboxIcon,
  BedIcon,
  CalendarIcon,
  SettingsIcon,
} from "@/components/admin/Icons";

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

  // Značka nepročitanih DM-ova uz "Portal" link (Faza 3) — samo punim
  // adminima/superadminima, isto ograničenje kao sam Portal (requireFullAdmin).
  let unreadDmCount = 0;
  // Plan #22: stavke za Cmd+K paletu — samo za tim (vlasnik ima 5 stavki u izborniku).
  let paletteItems: PaletteItem[] = [];
  if (admin && admin.role !== "owner") {
    const [dmCount, palette] = await Promise.all([
      countUnreadDirectMessages(admin.email),
      getCommandPaletteItems(),
    ]);
    unreadDmCount = dmCount;
    const sup = admin.isSuperAdmin;
    paletteItems = [
      ...(sup
        ? [
            { id: "novi-klijent", label: "Novi klijent", href: "/admin/novi-klijent", group: "Radnje" as const, keywords: ["dodaj", "klijent", "čarobnjak"] },
            { id: "pozovi", label: "Pozovi admina ili vlasnika", href: "/admin/admins/new", group: "Radnje" as const, keywords: ["pozivnica", "dodaj"] },
          ]
        : []),
      { id: "nova-vikendica", label: "Nova vikendica", href: "/admin/properties/new", group: "Radnje" as const },
      { id: "nova-firma", label: "Nova firma", href: "/admin/companies/new", group: "Radnje" as const },
      { id: "pregled", label: "Pregled", href: "/admin", group: "Idi na" as const, keywords: ["danas", "početna"] },
      { id: "upiti", label: "Upiti", href: "/admin/inquiries", group: "Idi na" as const },
      { id: "vikendice", label: "Vikendice", href: "/admin/vikendice", group: "Idi na" as const },
      { id: "firme", label: "Firme", href: "/admin#firme", group: "Idi na" as const },
      { id: "agencija", label: "Sadržaj agencije", href: "/admin/agency", group: "Idi na" as const },
      { id: "popusti", label: "Popusti i kodovi", href: "/admin/popusti", group: "Idi na" as const, keywords: ["kod", "akcija", "preporuka"] },
      ...(sup ? [{ id: "financije", label: "Financije", href: "/admin/financije", group: "Idi na" as const, keywords: ["pretplate", "uplate", "mrr"] }] : []),
      { id: "portal", label: "Portal", href: "/admin/portal", group: "Idi na" as const, keywords: ["zadaci", "poruke", "chat"] },
      { id: "aktivnost", label: "Aktivnost", href: "/admin/aktivnost", group: "Idi na" as const, keywords: ["dnevnik", "log"] },
      ...(sup ? [{ id: "admini", label: "Admini", href: "/admin/admins", group: "Idi na" as const, keywords: ["tim", "vlasnici"] }] : []),
      { id: "postavke", label: "Postavke", href: "/admin/settings", group: "Idi na" as const },
      ...palette.properties.map((p) => ({
        id: `v-${p.id}`,
        label: p.name,
        href: `/admin/vikendice/${p.id}`,
        group: "Vikendice" as const,
        keywords: [p.slug, "kalendar", "rezervacije"],
        hint: `/${p.slug}`,
      })),
      ...palette.companies.map((c) => ({
        id: `f-${c.id}`,
        label: c.name,
        href: `/admin/companies/${c.id}`,
        group: "Firme" as const,
        keywords: [c.slug],
        hint: `/${c.slug}`,
      })),
    ];
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
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 neu-header flex-wrap gap-2 sm:gap-3">
        <span className="font-bold tracking-tight">
          NOVO <span className="text-[#ff7f00]">admin</span>
        </span>
        {admin && admin.role === "owner" && (
          // Plan #34: kraći vrh na mobitelu — umjesto cijelog retka s čipom
          // "VLASNIK · …", e-mailom i Odjavom, gore desno je samo ikona za
          // javnu stranicu. Odjava je u Postavkama; na većem ekranu ostaje i ovdje.
          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:inline owner-header-faint text-sm">{admin.email}</span>
            <Link
              href={ownerPageHref ?? "/"}
              target="_blank"
              className="na-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5"
              aria-label={ownerLabel ? `Pogledaj stranicu ${ownerLabel}` : "Pogledaj stranicu"}
              title="Pogledaj stranicu"
            >
              <ExternalLinkIcon />
              <span className="hidden sm:inline">Pogledaj stranicu</span>
            </Link>
            <form action={logoutAction} className="hidden sm:block">
              <button type="submit" className="na-btn-ghost px-3 py-1.5">
                <LogOutIcon /> Odjava
              </button>
            </form>
          </div>
        )}
        {admin && admin.role === "owner" && (
          // Task #14 ("full-width grid, mobile+desktop") — vlasnik ima samo 5
          // odredišta pa ne treba hamburger-skriveni .neu-nav punog admina
          // ispod: mreža je uvijek vidljiva, na vlastitom retku ispod loga
          // (w-full ovdje forsira prijelom u redu jer je <header> flex-wrap),
          // i sama se rasteže preko cijele širine na svakoj veličini zaslona
          // umjesto da se lijevo poravnato lomi kao ranija pilula-traka.
          // DEVETI KRUG ("navbar izgleda katastrofa, zauzima pola ekrana") —
          // gap/padding stisnuti na mobitelu (gap-2/py-3 umjesto gap-3/py-4),
          // ikone u mreži spuštene na 18px (bile 20px) da 5 pločica stanu u
          // jedan red (vidi .owner-menu-grid: repeat(5, 1fr) u globals.css)
          // bez guranja, a sirovi e-mail u retku ispod je sad hidden na
          // mobitelu (hidden sm:inline) — značka "vlasnik · ..." dolje već
          // nosi istu informaciju sažetije.
          <div className="w-full flex flex-col gap-2 sm:gap-3">
            <nav className="owner-menu-grid" aria-label="Glavni izbornik">
              {/* Vlasnik ima samo ograničen pregled — ne smije uređivati stranicu.
                  /admin sad prikazuje njegov vlastiti dashboard (vidi
                  app/admin/page.tsx), ne puni pregled kao za role="admin". */}
              <AdminNavLink href="/admin" exact className="owner-menu-tile">
                <span className="owner-menu-tile-icon"><HomeIcon size={18} /></span>
                <span>Početna</span>
              </AdminNavLink>
              <AdminNavLink href="/admin/inquiries" className="owner-menu-tile">
                <span className="owner-menu-tile-icon"><InboxIcon size={18} /></span>
                <span>Upiti</span>
              </AdminNavLink>
              <AdminNavLink href="/admin/rezervacije" className="owner-menu-tile">
                <span className="owner-menu-tile-icon"><BedIcon size={18} /></span>
                <span>Rezervacije</span>
              </AdminNavLink>
              <AdminNavLink href="/admin/kalendar" className="owner-menu-tile">
                <span className="owner-menu-tile-icon"><CalendarIcon size={18} /></span>
                <span>Kalendar</span>
              </AdminNavLink>
              <AdminNavLink href="/admin/settings" className="owner-menu-tile">
                <span className="owner-menu-tile-icon"><SettingsIcon size={18} /></span>
                <span>Postavke</span>
              </AdminNavLink>
            </nav>
          </div>
        )}
        {admin && admin.role !== "owner" && (
          <>
            {/* Čisto CSS "hamburger" (checkbox hack, bez klijentske komponente/JS-a) —
                s puno stavki u navu (do 9+ linkova za punog admina) na mobitelu se
                dosad samo ružno lomilo u više redaka preko flex-wrap; sad je iznad
                sm praga sakriveno iza gumba. Relevantno i jer admin panel već ima
                PWA "dodaj na početni zaslon" podršku (vidi PwaRegister gore), znači
                stvarno se koristi na mobitelu. Vlasnik (role="owner") više ne prolazi
                ovim putem — vidi granu iznad, Task #14. */}
            {/* PETI KRUG ("nije sve centrirano") — e-mail i Odjava na desktopu
                sjede u GORNJEM retku desno od loga, a ispod je red samo s
                linkovima. Ranije je sve (9 linkova + e-mail + Odjava) bilo u
                jednom flex redu koji se na 1440px lomio pa je "Odjava" ostajala
                sama u drugom redu. Na mobitelu ostaju unutar hamburger izbornika
                (vidi sm:hidden kopije dolje). */}
            <div className="flex items-center gap-3 ml-auto">
              <CommandPalette items={paletteItems} />
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span className="owner-header-faint flex items-center gap-1.5 text-sm">
                {admin.email}
                {admin.isSuperAdmin && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ff7f00]/10 text-[#b35600]">
                    glavni
                  </span>
                )}
              </span>
              <form action={logoutAction}>
                <button type="submit" className="neu-btn px-3 py-1.5 text-sm">
                  <LogOutIcon /> Odjava
                </button>
              </form>
            </div>
            <input type="checkbox" id="admin-nav-toggle" className="peer hidden" />
            <label
              htmlFor="admin-nav-toggle"
              className="sm:hidden neu-toggle admin-nav-toggle-btn px-3 py-1.5"
              aria-label="Izbornik"
            >
              <MenuIcon />
            </label>
            <nav className="hidden peer-checked:flex sm:flex items-start sm:items-center gap-3 sm:gap-2.5 text-sm flex-col sm:flex-row w-full flex-wrap neu-nav">
              {/* Plan #22: izbornik grupiran po namjeni — klijenti, novac, tim —
                  s tankim razdjelnicima; sve ostalo dohvatljivo i preko Cmd+K. */}
              <AdminNavLink href="/admin" exact>
                Pregled
              </AdminNavLink>
              <span className="neu-nav-sep" aria-hidden="true" />
              {/* Kalendar/Rezervacije/Upiti su grupirani pod jedan hub (bira se
                  vikendica pa se tek onda vidi njen kalendar/rezervacije/upiti),
                  vidi app/admin/vikendice. */}
              <AdminNavLink href="/admin/vikendice">
                Vikendice
              </AdminNavLink>
              <AdminNavLink href="/admin#firme">
                Firme
              </AdminNavLink>
              <AdminNavLink href="/admin/agency">
                Sadržaj agencije
              </AdminNavLink>
              <AdminNavLink href="/admin/popusti">
                Popusti
              </AdminNavLink>
              {admin.isSuperAdmin && (
                <>
                  <span className="neu-nav-sep" aria-hidden="true" />
                  <AdminNavLink href="/admin/financije">
                    Financije
                  </AdminNavLink>
                </>
              )}
              <span className="neu-nav-sep" aria-hidden="true" />
              {/* Portal (Faza 3) — spojeni Zadaci+Poruke+DM+statistika tab
                  ("Zadaci i poruke nek budu u jednom tabu, 'Portal'"),
                  dostupno SVIM punim adminima i superadminima, ne samo
                  glavnom (na izričit zahtjev iz Faze 2, i dalje vrijedi),
                  za razliku od Financije/Admini ispod koji ostaju samo za
                  superadmina. */}
              <AdminNavLink href="/admin/portal">
                Portal
                {unreadDmCount > 0 && (
                  // Značka (korisnički feedback: "preblizu slovima i nije centrirano")
                  // — razmak od teksta sad daje .neu-nav > a (inline-flex + gap,
                  // vidi globals.css; ranije je inline-block poništavao gap), a
                  // sama značka centrira broj flexom uz fiksnu min-w/h, pa je
                  // savršen krug za jednu znamenku i lijepo se širi za dvije.
                  <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 text-[10px] font-bold rounded-full bg-[#ff7f00] text-white leading-none">
                    {unreadDmCount}
                  </span>
                )}
              </AdminNavLink>
              <AdminNavLink href="/admin/aktivnost">
                Aktivnost
              </AdminNavLink>
              {admin.isSuperAdmin && (
                <AdminNavLink href="/admin/admins">
                  Admini
                </AdminNavLink>
              )}
              <span className="neu-nav-sep" aria-hidden="true" />
              <AdminNavLink href="/admin/settings">
                Postavke
              </AdminNavLink>
              {/* "Pogledaj stranicu" namjerno OSTAJE obični Link, ne AdminNavLink
                  — vodi na javnu stranicu (druga domena/ruta), nije "sekcija"
                  admina u kojoj se može "biti", pa aktivno stanje nema smisla. */}
              <Link href={ownerPageHref ?? "/"} target="_blank" className="inline-flex items-center gap-1">
                Pogledaj stranicu <ExternalLinkIcon />
              </Link>
              <span className="owner-header-faint flex items-center gap-1.5 sm:hidden">
                {admin.email}
                {admin.isSuperAdmin && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ff7f00]/10 text-[#b35600]">
                    glavni
                  </span>
                )}
              </span>
              <form action={logoutAction} className="sm:hidden">
                <button type="submit" className="neu-btn px-3 py-1.5">
                  <LogOutIcon /> Odjava
                </button>
              </form>
            </nav>
          </>
        )}
      </header>
      {/* Plan #23: superadmin tablice i Pregled dobivaju širu površinu
          (ranije ~900 px i na 1440 px ekranu). Vlasnik ostaje na užem. */}
      <main className={(isOwner ? "max-w-4xl" : "max-w-6xl") + " mx-auto px-4 sm:px-6 py-6 sm:py-10"}>{children}</main>
    </div>
  );
}

