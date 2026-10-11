import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, DM_Sans, Fraunces, Inter_Tight, Manrope, Newsreader } from "next/font/google";
import "./jelovnik.css";

/* KANDIDATI (privremeno): tri smjera, svaki sa svojim parom fontova. Bira se atributom data-dir na <html>. */
const o = { subsets: ["latin", "latin-ext"] as ("latin" | "latin-ext")[], display: "swap" as const };
const newsreader = Newsreader({ ...o, variable: "--jl-f-newsreader", axes: ["opsz"] });
const interTight = Inter_Tight({ ...o, variable: "--jl-f-intertight" });
const bodoni = Bodoni_Moda({ ...o, variable: "--jl-f-bodoni", axes: ["opsz"] });
const dmSans = DM_Sans({ ...o, variable: "--jl-f-dmsans", axes: ["opsz"] });
const fraunces = Fraunces({ ...o, variable: "--jl-f-fraunces", axes: ["opsz"] });
const manrope = Manrope({ ...o, variable: "--jl-f-manrope" });

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#0d0c0b",
  colorScheme: "dark",
};

export default function JelovnikLayout({ children }: { children: React.ReactNode }) {
  const fonts = [newsreader, interTight, bodoni, dmSans, fraunces, manrope].map((f) => f.variable).join(" ");
  return <div className={`jl ${fonts}`}>{children}</div>;
}
