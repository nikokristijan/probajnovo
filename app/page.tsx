import type { Metadata } from "next";
import { redirect } from "next/navigation";
import NovoHome from "@/components/NovoHome";
import { loadNovoHomeData } from "@/lib/novoHomeData";
import ConsentTracking from "@/components/novo/ConsentTracking";
import { IMG_SIZES, isBlobImageUrl, responsiveImgSource } from "@/lib/blob-image";

export const revalidate = 0; // uvijek svježe iz baze (admin izmjene odmah vidljive)

// Naslov, opis i Open Graph dolaze iz app/layout.tsx. Canonical je bitan jer ista
// naslovnica odgovara i na ?view=studies / ?view=office.
export const metadata: Metadata = {
  alternates: { canonical: "https://www.probajnovo.com" },
};

const VALID_VIEWS = new Set(["home", "studies", "office"]);

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  // Stari linkovi na "/?view=products" — proizvodi sad imaju svoju adresu.
  if (view === "products") redirect("/proizvodi");
  const initialView = VALID_VIEWS.has(view ?? "") ? (view as "home" | "studies" | "office") : undefined;

  const data = await loadNovoHomeData();

  // GALERIJA prozor (prva slika = vidljiva iznad pregiba) se na klijentu montira tek nakon hidracije
  // (položaj ovisi o veličini prozora), pa je preglednik ne bi našao u početnom HTML-u. Preload s istim
  // srcset/sizes kao <img> u ExhibitContent pokreće preuzimanje odmah, paralelno s JS-om.
  const firstExhibit = data.projects[0]?.images[0];
  const exhibitPreload = isBlobImageUrl(firstExhibit) ? responsiveImgSource(firstExhibit, IMG_SIZES.exhibit) : null;

  return (
    <>
      {exhibitPreload && (
        <link
          rel="preload"
          as="image"
          href={exhibitPreload.src}
          imageSrcSet={exhibitPreload.srcSet}
          imageSizes={exhibitPreload.sizes}
          fetchPriority="high"
        />
      )}
      <NovoHome
        heroTitle={data.heroTitle}
        officeText={data.officeText}
        contactEmail={data.contactEmail}
        instagramHandle={data.instagramHandle}
        city={data.city}
        projects={data.projects}
        products={data.products}
        initialView={initialView}
      />
      <ConsentTracking metaPixelId={data.metaPixelId} gaMeasurementId={data.gaMeasurementId} />
    </>
  );
}
