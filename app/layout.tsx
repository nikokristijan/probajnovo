import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Zilla_Slab, Karla } from "next/font/google";
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

export const metadata: Metadata = {
  title: "NOVO",
  description: "NOVO — kreativna agencija iz Slavonskog Broda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hr"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${zillaSlab.variable} ${karla.variable}`}
      >
    <body>{children}</body>
    </html>
    );
}
