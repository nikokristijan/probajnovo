import type { Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./digitalni-jelovnik.css";

/**
 * Fontovi samo za crtež mobitela s crnim jelovnikom (isti kao na javnom jelovniku, vidi app/jelovnik/layout.tsx).
 * Jedna težina serifa i dvije težine sansa, s podskupom latin-ext zbog hrvatskih slova.
 */
const serif = Cormorant_Garamond({
  variable: "--dj-font-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  display: "swap",
});
const sans = Jost({
  variable: "--dj-font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function DigitalniJelovnikLayout({ children }: { children: React.ReactNode }) {
  return <div className={`dj ${serif.variable} ${sans.variable}`}>{children}</div>;
}
