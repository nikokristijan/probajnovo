import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./jelovnik.css";

/**
 * Fontovi javnog jelovnika (samo ruta /jelovnik): Newsreader za naslove i nazive jela (optička veličina prati veličinu slova),
 * DM Sans za tekst i sučelje. Samo latin + latin-ext, jer hrvatska slova (č, ć, š, đ, ž) nisu u "latin" podskupu pa bi se
 * inače crtala zamjenskim fontom. Oba su promjenjiva (jedna datoteka po podskupu).
 */
const display = Newsreader({ variable: "--jl-font-display", subsets: ["latin", "latin-ext"], display: "swap", axes: ["opsz"] });
const sans = DM_Sans({ variable: "--jl-font-sans", subsets: ["latin", "latin-ext"], display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#0d0c0b",
  colorScheme: "dark",
};

export default function JelovnikLayout({ children }: { children: React.ReactNode }) {
  return <div className={`jl ${display.variable} ${sans.variable}`}>{children}</div>;
}
