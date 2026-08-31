import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getPropertyBySlug, getCompanyBySlug, getAgency } from "@/lib/db/queries";
import { getEnglishPropertyContent } from "@/lib/translate";
import { PropertyView } from "../../[slug]/page";

export const revalidate = 0;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property || !property.published) return {};

  const en = await getEnglishPropertyContent(property);
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
  const [property, agency] = await Promise.all([getPropertyBySlug(slug), getAgency()]);

  if (property && property.published) {
    const en = await getEnglishPropertyContent(property);
    if (!en) {
      // Nema DeepL ključa (ili nikad nije uspio) i nema starog keša — nemamo
      // što prikazati kao "engleski", radije vratimo gosta na hrvatsku stranicu
      // nego da "/en/" URL tiho prikaže hrvatski tekst.
      redirect(`/${slug}`);
    }
    const translatedProperty = { ...property, ...en };
    return <PropertyView property={translatedProperty} agency={agency} lang="en" />;
  }

  const company = await getCompanyBySlug(slug);
  if (company && company.published) {
    // Firme (companies) još nemaju prijevod — vodimo gosta na postojeću HR stranicu.
    redirect(`/${slug}`);
  }

  notFound();
}
