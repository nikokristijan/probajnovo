import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Zilla_Slab, Karla, Caveat, Inter, Fraunces, Baloo_2, Nunito } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
/** Grand layout — visoka, tanka serifna vitrina. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});
/** Drop mikrostranica (/drop) — igriv, "bubble" naslovni font za izmišljeni
 * GenZ fizički-newsletter koncept (showcase primjer, ne pravi klijent). */
const baloo2 = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});
/** Drop mikrostranica — zaobljeni, prijateljski font za tijelo teksta. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const SITE_URL = "https://www.probajnovo.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NOVO — kreativni studio iz Slavonskog Broda",
    template: "%s — NOVO",
  },
  description:
    "NOVO je kreativni studio iz Slavonskog Broda — brend identitet, digitalni dizajn, web stranice za vikendice i firme, NFC pločice i prostorna slova po mjeri.",
  icons: {
    icon: "/favicon-orange.png",
  },
  openGraph: {
    title: "NOVO — kreativni studio iz Slavonskog Broda",
    description:
      "Brend identitet, digitalni dizajn, web stranice za vikendice i firme, NFC pločice i prostorna slova po mjeri.",
    url: SITE_URL,
    siteName: "NOVO",
    locale: "hr_HR",
    type: "website",
    images: [{ url: "/novo-logo.png", width: 1474, height: 497 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NOVO — kreativni studio iz Slavonskog Broda",
    description:
      "Brend identitet, digitalni dizajn, web stranice za vikendice i firme, NFC pločice i prostorna slova po mjeri.",
    images: ["/novo-logo.png"],
  },
};

/**
 * Organization JSON-LD — statični fallback podaci (isti defaulti kao u
 * app/page.tsx kad admin još nije popunio agency zapis u bazi), ne dohvaća
 * bazu jer je layout.tsx zajednički za sve rute uključujući /admin. Ako
 * admin kasnije promijeni email/Instagram/grad u /admin/settings, ova
 * strukturirana oznaka ostaje na zadanim vrijednostima dok se ručno ne
 * ažurira — manji nedostatak, ne utječe na stvaran sadržaj stranice.
 */
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "NOVO",
  url: SITE_URL,
  logo: `${SITE_URL}/novo-logo.png`,
  email: "hello@novo.studio",
  sameAs: ["https://instagram.com/novo.hr"],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Slavonski Brod",
    addressCountry: "HR",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hr"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${zillaSlab.variable} ${karla.variable} ${caveat.variable} ${inter.variable} ${fraunces.variable} ${baloo2.variable} ${nunito.variable}`}
      >
    <body>
      {/* Statični, hardkodirani JSON-LD (ne user input) — sigurno za dangerouslySetInnerHTML. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />
      {children}
      <Analytics />
    </body>
    </html>
    );
}
