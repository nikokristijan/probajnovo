"use client";

import { useEffect } from "react";
import {
  Anton,
  Bebas_Neue,
  Archivo_Black,
  Montserrat,
  Poppins,
  Oswald,
  Orbitron,
  Playfair_Display,
  Pacifico,
  Righteous,
} from "next/font/google";
import SlovaCustomizer from "./SlovaCustomizer";

/**
 * Fontovi za konfigurator, učitani ovdje (a ne samo u app/slova/page.tsx) jer
 * se ova komponenta koristi i unutar OS shella (NovoHome.tsx) — klik na
 * "Custom slova po mjeri" u PROIZVODI tabu otvara je kao cijeli zaslon unutar
 * SPA-a, učitano preko next/dynamic sa ssr:false u NovoHome.tsx, da posjetitelji
 * naslovnice ne preuzimaju ovih 10 fontova ako konfigurator uopće ne otvore.
 * next/font ne dopušta dinamičko učitavanje po imenu u runtimeu, zato je popis
 * namjerno identičan onome u app/slova/page.tsx — dodaš li font u
 * lib/slovaFonts.ts, dodaj ga i ovdje i tamo.
 */
const anton = Anton({ variable: "--font-slova-anton", subsets: ["latin"], weight: "400" });
const bebasNeue = Bebas_Neue({ variable: "--font-slova-bebas", subsets: ["latin"], weight: "400" });
const archivoBlack = Archivo_Black({ variable: "--font-slova-archivo", subsets: ["latin"], weight: "400" });
const montserrat = Montserrat({ variable: "--font-slova-montserrat", subsets: ["latin"], weight: ["700", "800"] });
const poppins = Poppins({ variable: "--font-slova-poppins", subsets: ["latin"], weight: ["700", "800"] });
const oswald = Oswald({ variable: "--font-slova-oswald", subsets: ["latin"], weight: ["600", "700"] });
const orbitron = Orbitron({ variable: "--font-slova-orbitron", subsets: ["latin"], weight: ["700", "900"] });
const playfairDisplay = Playfair_Display({
  variable: "--font-slova-playfair",
  subsets: ["latin"],
  weight: ["700", "800"],
});
const pacifico = Pacifico({ variable: "--font-slova-pacifico", subsets: ["latin"], weight: "400" });
const righteous = Righteous({ variable: "--font-slova-righteous", subsets: ["latin"], weight: "400" });

const FONT_VARS = [
  anton.variable,
  bebasNeue.variable,
  archivoBlack.variable,
  montserrat.variable,
  poppins.variable,
  oswald.variable,
  orbitron.variable,
  playfairDisplay.variable,
  pacifico.variable,
  righteous.variable,
].join(" ");

function CompressIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden="true">
      <path
        d="M4.5 1v3.5H1M7.5 1v3.5H11M4.5 11V7.5H1M7.5 11V7.5H11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  /** Skuplja prozor natrag na mali plutajući popup (ne zatvara ga potpuno). */
  onExitFullscreen: () => void;
  /** Zatvara prozor potpuno. */
  onClose: () => void;
};

/**
 * Cijeli zaslon konfiguratora prostornih slova unutar OS shella — isti
 * vizualni jezik kao ProductFullscreenPage u NovoHome.tsx (koji "pravi",
 * baza-proizvodi koriste kad se prošire iz malog prozora), samo ovdje
 * umjesto galerije/opisa prikazuje sam SlovaCustomizer. Otvara se klikom na
 * ikonu širenja u malom "CUSTOM SLOVA PO MJERI" prozoru — ne page-
 * navigacijom, ostaje unutar SPA-a i Escape/× ga skupljaju/zatvaraju kao i
 * svaki drugi proizvod.
 */
export default function SlovaFullscreenOverlay({ onExitFullscreen, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExitFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExitFullscreen]);

  return (
    // product-full = fiksni fullscreen chrome (vidi ProductFullscreenPage u
    // NovoHome.tsx). novo-product-page + slova-page moraju biti ovdje, ne
    // samo na app/slova/page.tsx-u — slova.css oslanja se na CSS varijable
    // (--ink, --paper, --dim, --accent, --plaster) definirane u
    // .novo-product-page scope-u u globals.css, i na ".slova-page" selektor
    // za stilizaciju gumba za upit; bez ovih klasa SlovaCustomizer bi ovdje
    // izgubio boje/kontrast (var(--dim) i sl. bi bili neispravni/nedefinirani).
    <div className={`${FONT_VARS} product-full novo-product-page slova-page`}>
      <div className="product-full-topbar">
        <span className="product-full-brand mono muted">NOVO — PROSTORNA SLOVA</span>
        <div className="fw-controls">
          <button
            className="fw-btn"
            onClick={onExitFullscreen}
            aria-label="Izađi iz cijelog zaslona — natrag na prozor"
          >
            <CompressIcon />
          </button>
          <button className="fw-btn" onClick={onClose} aria-label="Zatvori">
            ×
          </button>
        </div>
      </div>
      <div className="product-full-scroll">
        <SlovaCustomizer />
      </div>
    </div>
  );
}
