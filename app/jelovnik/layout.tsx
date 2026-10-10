import type { Metadata, Viewport } from "next";
import "./jelovnik.css";

/**
 * Javni jelovnici lokala (/jelovnik/<slug>), u NOVO stilu. Ne indeksiraju se (ni stranice ni poveznice) i nisu u
 * sitemapu: to su privatne stranice za goste koji su skenirali QR kod, ne marketinški sadržaj.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function JelovnikLayout({ children }: { children: React.ReactNode }) {
  return <div className="jl">{children}</div>;
}
