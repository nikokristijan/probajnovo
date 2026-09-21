import type { Metadata } from "next";
import Link from "next/link";
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
import SlovaCustomizer from "@/components/slova/SlovaCustomizer";
import LegalFooterLinks from "@/components/LegalFooterLinks";

/**
 * /slova — konfigurator za prostorna (custom) slova, drugi fizički proizvod
 * uz NFC pločice (vidi app/proizvodi). Svaki font koji korisnik može
 * izabrati u konfiguratoru mora biti učitan ovdje preko next/font/google
 * (statički, na build-u — next/font ne dopušta dinamičko učitavanje po
 * imenu u runtimeu) i naveden u lib/slovaFonts.ts pod istim cssVar imenom.
 * Space Grotesk nije ovdje jer je već globalno učitan u app/layout.tsx.
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

export const metadata: Metadata = {
  title: "Prostorna slova po mjeri — NOVO",
  description:
    "Izradimo vam prostorna slova po mjeri, u fontu, veličini i boji koju odaberete. Ispišite tekst, pogledajte uživo prije narudžbe i pošaljite upit.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/slova" },
  icons: { icon: "/favicon-orange.png" },
  openGraph: {
    title: "Prostorna slova po mjeri — NOVO",
    description: "Font, veličina i boja po vašem izboru. Pogledajte uživo prije narudžbe.",
    url: "https://www.probajnovo.com/slova",
  },
};

export default function SlovaPage() {
  return (
    <div className={FONT_VARS}>
      <div className="novo-product-page slova-page">
        <div className="novo-product-topbar">
          <Link href="/" className="novo-product-logo">
            NOVO
          </Link>
          <Link href="/?view=products" className="novo-product-back">
            ← SVI PROIZVODI
          </Link>
        </div>
        <SlovaCustomizer />
        <div className="novo-product-wrap" style={{ paddingTop: 0 }}>
          <LegalFooterLinks />
        </div>
      </div>
    </div>
  );
}
