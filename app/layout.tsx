import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Zilla_Slab, Karla, Caveat, Inter, Fraunces, Baloo_2, Nunito } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import AutomationKick from "@/components/AutomationKick";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

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
  // Ne preloadamo na svakoj stranici: koristi se samo u pojedinim izgledima (vikendice, /drop).
  preload: false,
  variable: "--font-zilla-slab",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const karla = Karla({
  // Ne preloadamo na svakoj stranici: koristi se samo u pojedinim izgledima (vikendice, /drop).
  preload: false,
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
/** Rukom pisani font — Classic pečat i potpisi ispod polaroida (stay layout). */
const caveat = Caveat({
  // Ne preloadamo na svakoj stranici: koristi se samo u pojedinim izgledima (vikendice, /drop).
  preload: false,
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});
/** Apple layout — bliže sistemskom San Francisco fontu nego Space Grotesk/Karla. */
const inter = Inter({
  // Ne preloadamo na svakoj stranici: koristi se samo u pojedinim izgledima (vikendice, /drop).
  preload: false,
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
/** Grand layout — visoka, tanka serifna vitrina. */
const fraunces = Fraunces({
  // Ne preloadamo na svakoj stranici: koristi se samo u pojedinim izgledima (vikendice, /drop).
  preload: false,
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});
/** Drop mikrostranica (/drop) — igriv, "bubble" naslovni font za izmišljeni
 * GenZ fizički-newsletter koncept (showcase primjer, ne pravi klijent). */
const baloo2 = Baloo_2({
  // Ne preloadamo na svakoj stranici: koristi se samo u pojedinim izgledima (vikendice, /drop).
  preload: false,
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});
/** Drop mikrostranica — zaobljeni, prijateljski font za tijelo teksta. */
const nunito = Nunito({
  // Ne preloadamo na svakoj stranici: koristi se samo u pojedinim izgledima (vikendice, /drop).
  preload: false,
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const SITE_URL = "https://www.probajnovo.com";
const DEFAULT_TITLE = "NOVO — web stranice, brending i digitalni proizvodi | Slavonski Brod";
const DEFAULT_DESCRIPTION =
  "NOVO je kreativni studio iz Slavonskog Broda: web stranice, brend identitet, NFC pločice, digitalni jelovnik, Google recenzije i prostorna slova po mjeri.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s — NOVO",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: "NOVO",
  icons: {
    icon: "/favicon-orange.png",
  },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: "NOVO",
    locale: "hr_HR",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
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
  "@id": `${SITE_URL}/#organization`,
  name: "NOVO",
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  logo: `${SITE_URL}/novo-logo.png`,
  email: "hello@novo.studio",
  sameAs: ["https://instagram.com/novo.hr"],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Slavonski Brod",
    addressCountry: "HR",
  },
  areaServed: { "@type": "Country", name: "Hrvatska" },
};

/** WebSite JSON-LD — naziv stranice u Google rezultatima ("NOVO" umjesto domene). */
const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "NOVO",
  alternateName: "probajnovo.com",
  url: SITE_URL,
  inLanguage: "hr-HR",
  publisher: { "@id": `${SITE_URL}/#organization` },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
      />
      {children}
      <Analytics />
      <AutomationKick />
    </body>
    </html>
    );
}
