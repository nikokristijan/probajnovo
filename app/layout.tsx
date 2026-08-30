import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Zilla_Slab, Karla, Caveat, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
subsets: ["latin"],
  weight: ["400", "500"],
});
const zillaSlab = Zilla_Slab({
  variable: "--font-zilla-slab",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
/** Rukom pisani font — Classic pečat i potpisi ispod polaroida (stay layout). */
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});
/** Apple layout — bliže sistemskom San Francisco fontu nego Space Grotesk/Karla. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "NOVO",
  description: "NOVO — kreativna agencija iz Slavonskog Broda.",
  icons: {
    icon: "/favicon-orange.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hr"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${zillaSlab.variable} ${karla.variable} ${caveat.variable} ${inter.variable}`}
      >
    <body>{children}</body>
    </html>
    );
}
