import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPropertyBySlug, getAgency } from "@/lib/db/queries";
import { getPropertyExtrasSafe } from "@/lib/db/units";
import { getEnglishPropertyContent } from "@/lib/translate";
import { UnitView } from "../../../[slug]/UnitView";
import { stayLinks, unitFacts, unitLabel } from "../../../[slug]/stay-shared";

export const revalidate = 0;

type Params = { slug: string; unit: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, unit: unitSlug } = await params;
  let property: Awaited<ReturnType<typeof getPropertyBySlug>> | null = null;
  try {
    property = await getPropertyBySlug(slug);
  } catch {
    return {};
  }
  if (!property || !property.published) return {};
  const { units } = await getPropertyExtrasSafe(property.id);
  const unit = units.find((u) => u.slug === unitSlug);
  if (!unit) return {};
  const title = `${unitLabel(unit, "en")} — ${property.location}`;
  const url = `https://www.probajnovo.com/en/${slug}/${unit.slug}`;
  return {
    title,
    description: unitFacts(unit, "en").join(" · "),
    robots: { index: true, follow: true },
    icons: { icon: property.faviconUrl || "/favicon-orange.png" },
    alternates: {
      canonical: url,
      languages: { hr: `https://www.probajnovo.com/${slug}/${unit.slug}`, en: url, "x-default": `https://www.probajnovo.com/${slug}/${unit.slug}` },
    },
  };
}

/** Engleska inačica podstranice apartmana (opće tekstove vikendice prevodi lib/translate.ts,
    tekstove apartmana admin unosi i na engleskom — vidi PropertyUnitsEditor). */
export default async function EnglishUnitPage({ params }: { params: Promise<Params> }) {
  const { slug, unit: unitSlug } = await params;
  const [property, agency] = await Promise.all([getPropertyBySlug(slug), getAgency()]);
  if (!property || !property.published) notFound();
  if (unitSlug === property.slug) redirect((await stayLinks(property.slug, "en")).home);
  const { units } = await getPropertyExtrasSafe(property.id);
  const unit = units.find((u) => u.slug === unitSlug);
  if (!unit) notFound();
  let translated = property;
  try {
    const en = await getEnglishPropertyContent(property);
    if (en) translated = { ...property, ...en };
  } catch (err) {
    console.error("[EnglishUnitPage] prijevod nije uspio:", err);
  }
  return <UnitView property={translated} agency={agency} unit={unit} units={units} lang="en" />;
}
