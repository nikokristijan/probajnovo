import type { Metadata } from "next";

/**
 * Zajednički SEO podaci za javne NOVO stranice.
 *
 * Zašto helper: u Next.js metadati dijete koje postavi `openGraph` ZAMIJENI
 * cijeli roditeljev `openGraph` objekt (nije dubinsko spajanje). Stranice koje
 * su postavljale samo naslov i URL time su gubile sliku, siteName i locale, a
 * stranice bez `openGraph` dijelile su naslovnicin og:title i og:url. Ovdje se
 * za svaku stranicu slaže potpun i ispravan set (canonical + Open Graph + Twitter).
 */

export const SITE_URL = "https://www.probajnovo.com";
export const SITE_NAME = "NOVO";

/** Zadana slika za dijeljenje (1200×630), generira je app/og-novo.png/route.tsx. */
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/og-novo.png`,
  width: 1200,
  height: 630,
  alt: "NOVO — kreativni studio iz Slavonskog Broda",
};

type OgImage = { url: string; width?: number; height?: number; alt?: string };

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (path === "/" || path === "") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Metadata za jednu javnu stranicu.
 * - `title`: bez " — NOVO" (doda ga predložak iz app/layout.tsx), osim kad je `absoluteTitle`.
 * - `path`: npr. "/proizvodi"; postaje canonical i og:url.
 * - `images`: po želji; bez njih ide zadana NOVO slika.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  images,
  locale = "hr_HR",
  languages,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  images?: OgImage[];
  locale?: string;
  languages?: Record<string, string>;
}): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = absoluteTitle ? title : `${title} — ${SITE_NAME}`;
  const ogImages = images && images.length ? images : [DEFAULT_OG_IMAGE];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale,
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ogImages.map((i) => i.url),
    },
  };
}

/** Skraćuje opis na ~155 znakova (koliko Google obično prikaže), na granici riječi. */
export function metaDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[,;:–—-]\s*$/, "")}…`;
}
