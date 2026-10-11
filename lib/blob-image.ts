import { getImageProps } from "next/image";

/**
 * Slike koje admin uploada idu na Vercel Blob (vidi app/api/blob/upload/route.ts) i stižu kao
 * originali u punoj veličini (često više MB). Za običan <img> (kad ne možemo koristiti <Image>,
 * jer CSS već stilizira postojeći element) ovdje dobijemo isti `src` / `srcSet` / `sizes` koje bi
 * izračunao next/image: /_next/image URL-ovi u više širina (WebP), umjesto originala.
 *
 * Optimizira se SAMO Blob domena (ista kao u next.config.ts `images.remotePatterns`); sve drugo
 * (lokalne /putanje, data: URI, tuđe domene, nevaljan URL) ostaje nepromijenjeno, pa ništa ne puca.
 */
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isBlobImageUrl(src: string | null | undefined): src is string {
  if (!src) return false;
  try {
    const u = new URL(src);
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export type ImgSource = { src: string; srcSet?: string; sizes?: string };

/**
 * `sizes` = koliko je slika široka u CSS-u (npr. "(max-width: 480px) 46vw, 280px"). Za ne-Blob
 * izvore vraća samo `src` (bez srcSet/sizes), kao i prije.
 */
export function responsiveImgSource(src: string, sizes: string): ImgSource {
  if (!isBlobImageUrl(src)) return { src };
  const { props } = getImageProps({ src, alt: "", fill: true, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}

/**
 * Jedna optimizirana adresa za atribute koji prihvaćaju samo jedan URL (npr. <video poster>).
 * Za Blob izvore vraća /_next/image?w=<širina>; ostalo vraća nepromijenjeno.
 * `width` mora biti jedna od images.deviceSizes u next.config.ts.
 */
export function singleImgUrl(src: string | undefined, width = 1080): string | undefined {
  if (!src || !isBlobImageUrl(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

/**
 * `sizes` po mjestu prikaza — izvedeno iz stvarnog CSS-a u app/globals.css (izmjereno u Chromiumu):
 *  - exhibit: GALERIJA prozor je fiksnih 230 px (.exhibit-img ~228 px)
 *  - projWindow: plutajući prozor projekta/proizvoda, 260 px
 *  - productFullHero: .product-full-body max 980 px, 1 stupac do 860 px (100vw - 40 px), inače ~468 px
 *  - productFullThumb: .product-full-thumb 56 px
 *  - productCard: .pl-grid, ≤480 px dva stupca (~45vw), 481–720 jedan/dva stupca (do ~340 px),
 *    721–960 do ~450 px, inače 4/3 kartica ~230–280 px
 *  - relatedTile: .ro-tile je 112 px široka traka dok je odjeljak uži od 640 px (mobitel), inače
 *    kartica ~200–330 px
 */
export const IMG_SIZES = {
  exhibit: "230px",
  projWindow: "260px",
  productFullHero: "(min-width: 860px) 470px, calc(100vw - 40px)",
  productFullThumb: "56px",
  relatedTile: "(max-width: 670px) 112px, 330px",
  productCard: "(max-width: 480px) 46vw, (max-width: 720px) 340px, (max-width: 960px) 450px, 280px",
} as const;
