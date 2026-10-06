"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type NovoView = "home" | "studies" | "office" | "products";

/**
 * Pravi URL svakog taba NOVO naslovnice. PROIZVODI ima vlastitu rutu
 * (/proizvodi) da se može linkati iz oglasa i tražilica; ostali tabovi žive
 * na naslovnici kao ?view=… (vidi app/page.tsx).
 */
export const VIEW_HREF: Record<NovoView, string> = {
  home: "/",
  studies: "/?view=studies",
  products: "/proizvodi",
  office: "/?view=office",
};

const NAV: { view: NovoView; label: string }[] = [
  { view: "home", label: "POČETNA" },
  { view: "studies", label: "RADOVI" },
  { view: "products", label: "PROIZVODI" },
  { view: "office", label: "STUDIO" },
];

/** Klik s Cmd/Ctrl/Shift ili srednjom tipkom = korisnik želi novu karticu — ne presrećemo. */
function isModifiedClick(e: React.MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

/**
 * Zajednički "OS" okvir NOVO stranica: logo + koordinate gore, izbornik
 * lijevo, kontakt desno, podnožje dolje. Koriste ga naslovnica
 * (NovoHome, tabovi se mijenjaju bez učitavanja preko `onSelect`) i
 * stranice proizvoda (/proizvodi/[slug], izbornik su obični linkovi).
 * Svaka stavka izbornika je pravi <a href>, pa radi i "otvori u novoj
 * kartici", a tražilice vide sve rute.
 */
export default function NovoShell({
  active,
  onSelect,
  contactEmail,
  instagramHandle,
  city,
  variant,
  overlay,
  children,
}: {
  active: NovoView;
  onSelect?: (view: NovoView) => void;
  contactEmail: string;
  instagramHandle: string;
  city: string;
  /** "detail" = stranica jednog proizvoda: na mobitelu skriva kontakt traku da ostane mjesta za sadržaj. */
  variant?: "detail";
  /** Plutajući prozori i sl. — renderiraju se izvan <main> (position: fixed). */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // Bez scrolla stranice: sadržaj se scrolla unutar <main>. Iznimka je
  // stranica proizvoda (variant "detail") — ona je duga pa se scrolla kao
  // obična web stranica (prirodan scroll na mobitelu, adresna traka se skriva).
  useEffect(() => {
    if (variant === "detail") return;
    document.documentElement.classList.add("novo-lock-scroll");
    return () => document.documentElement.classList.remove("novo-lock-scroll");
  }, [variant]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setCoords({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const instaUrl = `https://instagram.com/${instagramHandle.replace(/^@/, "")}`;

  const navClick = (view: NovoView) => (e: React.MouseEvent) => {
    if (!onSelect || isModifiedClick(e)) return;
    e.preventDefault();
    onSelect(view);
  };

  return (
    <div className={variant === "detail" ? "novo-os novo-os--detail" : "novo-os"}>
      <div className="novo-os-topbar">
        <Link href="/" className="novo-os-brand" onClick={navClick("home")} aria-label="NOVO — natrag na početnu">
          <Image src="/novo-logo.png" alt="NOVO" className="novo-os-logo-img" width={1474} height={497} priority />
        </Link>
        <span className="novo-os-coords mono muted" aria-hidden="true">
          {coords.x}(X), {coords.y}(Y)
        </span>
      </div>

      <nav className="novo-os-nav" aria-label="Glavni izbornik">
        {NAV.map((item) => (
          <Link
            key={item.view}
            href={VIEW_HREF[item.view]}
            className={active === item.view ? "novo-os-navbtn active" : "novo-os-navbtn"}
            aria-current={active === item.view ? "page" : undefined}
            onClick={navClick(item.view)}
            scroll={false}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="novo-os-main">{children}</main>

      <aside className="novo-os-side">
        <div className="novo-os-side-block">
          <span className="mono muted">UPIT</span>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </div>
        <div className="novo-os-side-block">
          <span className="mono muted">PRATI NAS</span>
          <a href={instaUrl} target="_blank" rel="noreferrer">
            {instagramHandle}
          </a>
        </div>
        <div className="novo-os-side-block">
          <span className="mono muted">LOKACIJA</span>
          <span>{city}</span>
        </div>
      </aside>

      <div className="novo-os-footer">
        <span>© {new Date().getFullYear()} NOVO</span>
        <span>{city}</span>
      </div>

      {overlay}
    </div>
  );
}
