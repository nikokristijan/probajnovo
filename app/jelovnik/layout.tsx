import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./jelovnik.css";

/**
 * Fontovi javnog jelovnika. Učitavaju se ovdje (a ne u korijenskom layoutu) s podskupom latin-ext, jer hrvatska slova
 * (č, ć, š, đ, ž) nisu u "latin" podskupu pa bi se inače crtala zamjenskim fontom. Samo za rute /jelovnik.
 */
const serif = Cormorant_Garamond({
  variable: "--jl-font-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});
const sans = Jost({
  variable: "--jl-font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

/**
 * Javni jelovnici lokala (/jelovnik/<slug>), crni "luksuzni" stil. Ne indeksiraju se (ni stranice ni poveznice) i nisu u
 * sitemapu: to su privatne stranice za goste koji su skenirali QR kod, ne marketinški sadržaj.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function JelovnikLayout({ children }: { children: React.ReactNode }) {
  return <div className={`jl ${serif.variable} ${sans.variable}`}>{children}</div>;
}
