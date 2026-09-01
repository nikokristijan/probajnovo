import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getCurrentAdminRecord } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { listPropertiesForAdmin, listCompaniesForAdmin } from "@/lib/db/queries";
import PwaRegister from "@/components/admin/PwaRegister";

export const metadata: Metadata = {
  title: "NOVO — admin",
  robots: { index: false, follow: false },
  // PWA — omogućuje "Dodaj na početni zaslon" / "Instaliraj aplikaciju" za
  // /admin na mobitelu, vidi public/admin-manifest.json i PwaRegister.tsx.
  manifest: "/admin-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NOVO admin",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

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

  return (
    <div className="admin-shell">
      <PwaRegister />
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/10 bg-white flex-wrap gap-3">
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
              className="sm:hidden cursor-pointer border border-black/15 rounded-lg px-3 py-1.5 text-sm font-semibold"
              aria-label="Izbornik"
            >
              ☰
            </label>
            <nav className="hidden peer-checked:flex sm:flex items-start sm:items-center gap-3 sm:gap-5 text-sm flex-col sm:flex-row w-full sm:w-auto flex-wrap">
            {admin.role === "owner" ? (
              // Vlasnik ima samo ograničen pregled — ne smije uređivati stranicu.
              // /admin sad prikazuje njegov vlastiti dashboard (vidi app/admin/page.tsx),
              // ne puni pregled kao za role="admin".
              <>
                <Link href="/admin" className="hover:text-[#ff7f00]">
                  Početna
                </Link>
                <Link href="/admin/inquiries" className="hover:text-[#ff7f00]">
                  Upiti
                </Link>
                <Link href="/admin/rezervacije" className="hover:text-[#ff7f00]">
                  Rezervacije
                </Link>
                <Link href="/admin/kalendar" className="hover:text-[#ff7f00]">
                  Kalendar
                </Link>
              </>
            ) : (
              <>
                <Link href="/admin" className="hover:text-[#ff7f00]">
                  Pregled
                </Link>
                <Link href="/admin/agency" className="hover:text-[#ff7f00]">
                  Sadržaj agencije
                </Link>
                <Link href="/admin#firme" className="hover:text-[#ff7f00]">
                  Firme
                </Link>
                {/* Kalendar/Rezervacije/Upiti su grupirani pod jedan hub (bira se
                    vikendica pa se tek onda vidi njen kalendar/rezervacije/upiti)
                    umjesto tri zasebna taba koja su miješala sve vikendice odjednom
                    i postajala krcata — vidi app/admin/vikendice. */}
                <Link href="/admin/vikendice" className="hover:text-[#ff7f00]">
                  Vikendice
                </Link>
                <Link href="/admin/prodaja" className="hover:text-[#ff7f00]">
                  Prodaja
                </Link>
                <Link href="/admin/aktivnost" className="hover:text-[#ff7f00]">
                  Aktivnost
                </Link>
                {admin.isSuperAdmin && (
                  <Link href="/admin/admins" className="hover:text-[#ff7f00]">
                    Admini
                  </Link>
                )}
              </>
            )}
            <Link href="/admin/settings" className="hover:text-[#ff7f00]">
              Postavke
            </Link>
            <Link href={ownerPageHref ?? "/"} className="hover:text-[#ff7f00]" target="_blank">
              Pogledaj stranicu ↗
            </Link>
            <span className="text-black/40 flex items-center gap-1.5">
              {admin.email}
              {admin.isSuperAdmin && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ff7f00]/10 text-[#ff7f00]">
                  glavni
                </span>
              )}
              {admin.role === "owner" && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/5 text-black/50">
                  vlasnik{ownerLabel ? ` · ${ownerLabel}` : ""}
                </span>
              )}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-black/15 px-3 py-1.5 hover:border-[#ff7f00] hover:text-[#ff7f00]"
              >
                Odjava
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

