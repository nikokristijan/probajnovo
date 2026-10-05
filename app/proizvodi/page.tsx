import type { Metadata } from "next";
import NovoHome from "@/components/NovoHome";
import { loadNovoHomeData } from "@/lib/novoHomeData";
import ConsentTracking from "@/components/novo/ConsentTracking";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Proizvodi",
  description:
    "NFC pločice za WiFi, prostorna slova i ostali proizvodi za vikendice, apartmane i firme — izrađeni po mjeri u NOVO studiju.",
  alternates: { canonical: "https://www.probajnovo.com/proizvodi" },
  openGraph: {
    title: "Proizvodi — NOVO",
    description: "NFC pločice za WiFi, prostorna slova i ostali proizvodi za vikendice, apartmane i firme.",
    url: "https://www.probajnovo.com/proizvodi",
  },
};

/**
 * /proizvodi — ista NOVO naslovnica, otvorena na tabu PROIZVODI, ali s
 * vlastitim URL-om (za oglase, tražilice i dijeljenje). Klik na PROIZVODI
 * na naslovnici samo promijeni adresu u /proizvodi bez ponovnog učitavanja
 * (vidi NovoHome), a svaki proizvod vodi na /proizvodi/<slug>.
 */
export default async function ProductsPage() {
  const data = await loadNovoHomeData();
  return (
    <>
      <NovoHome
        heroTitle={data.heroTitle}
        officeText={data.officeText}
        contactEmail={data.contactEmail}
        instagramHandle={data.instagramHandle}
        city={data.city}
        projects={data.projects}
        products={data.products}
        initialView="products"
      />
      <ConsentTracking metaPixelId={data.metaPixelId} gaMeasurementId={data.gaMeasurementId} />
    </>
  );
}
