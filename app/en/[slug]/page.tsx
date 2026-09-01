import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getPropertyBySlug, getCompanyBySlug, getAgency } from "@/lib/db/queries";
import { getEnglishPropertyContent, type PropertyTranslationFields } from "@/lib/translate";
import { PropertyView } from "../../[slug]/page";

/**
 * Prijevod je "best effort" (vidi lib/translate.ts), ali za svaki slučaj da
 * getEnglishPropertyContent ipak baci grešku (npr. privremeni DB/network
 * hiccup), radije se tiho vratimo na hrvatski sadržaj nego da gost dobije
 * generičku error/404 stranicu.
 */
async function safeGetEnglishPropertyContent(
  property: Parameters<typeof getEnglishPropertyContent>[0]
): Promise<PropertyTranslationFields | null> {
  try {
    return await getEnglishPropertyContent(property);
  } catch (err) {
    console.error("[EnglishSlugPage] getEnglishPropertyContent nije uspio:", err);
    return null;
  }
}

export const revalidate = 0;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Best-effort, isti duh kao ispod u EnglishSlugPage — ako dohvat padne
  // (npr. privremeni DB hiccup), radije generiraj praznu metadata umjesto da
  // padne cijeli request za /en/[slug].
  let property: Awaited<ReturnType<typeof getPropertyBySlug>>;
  try {
    property = await getPropertyBySlug(slug);
  } catch (err) {
    console.error("[EnglishSlugPage] generateMetadata dohvat vikendice nije uspio:", err);
    return {};
  }
  if (!property || !property.published) return {};

  const en = await safeGetEnglishPropertyContent(property);
  const tagline = en?.tagline ?? property.tagline;
  const title = `${property.name} — ${property.location}`;
  const image = property.bannerImage || property.images[0];
  const url = `https://www.probajnovo.com/en/${slug}`;
  return {
    title,
    description: tagline,
    robots: { index: true, follow: true },
    icons: { icon: property.faviconUrl || "/favicon-orange.png" },
    alternates: {
      canonical: url,
      languages: { hr: `https://www.probajnovo.com/${slug}`, en: url },
    },
    openGraph: {
      title,
      description: tagline,
      url,
      siteName: "NOVO",
      locale: "en_US",
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: tagline,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/**
 * Engleska (auto-prevedena) inačica /[slug] — samo za vikendice (companies
 * nemaju prijevod za sad, pa se jednostavno vraćamo na hrvatsku stranicu).
 * Vidi lib/translate.ts za kako i kada se prijevod radi/kešira.
 */
export default async function EnglishSlugPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  // Ako sam dohvat vikendice/firme/agencije padne (npr. privremeni DB
  // hiccup), radije vratimo gosta na hrvatsku stranicu iste vikendice nego
  // da mu iskočiti generička 404/error stranica — vidi napomenu korisnika.
  let property: Awaited<ReturnType<typeof getPropertyBySlug>>;
  let agency: Awaited<ReturnType<typeof getAgency>>;
  try {
    [property, agency] = await Promise.all([getPropertyBySlug(slug), getAgency()]);
  } catch (err) {
    console.error("[EnglishSlugPage] dohvat vikendice/agencije nije uspio:", err);
    redirect(`/${slug}`);
  }

  if (property && property.published) {
    const en = await safeGetEnglishPropertyContent(property);
    if (!en) {
      // Nema DeepL ključa (ili nikad nije uspio) i nema starog keša — nemamo
      // što prikazati kao "engleski", radije vratimo gosta na hrvatsku stranicu
      // nego da "/en/" URL tiho prikaže hrvatski tekst.
      redirect(`/${slug}`);
    }
    const translatedProperty = { ...property, ...en };
    return <PropertyView property={translatedProperty} agency={agency} lang="en" />;
  }

  let company: Awaited<ReturnType<typeof getCompanyBySlug>> = null;
  try {
    company = await getCompanyBySlug(slug);
  } catch (err) {
    console.error("[EnglishSlugPage] dohvat firme nije uspio:", err);
    redirect(`/${slug}`);
  }
  if (company && company.published) {
    // Firme (companies) još nemaju prijevod — vodimo gosta na postojeću HR stranicu.
    redirect(`/${slug}`);
  }

  notFound();
}
