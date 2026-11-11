import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPropertyBySlug, getAgency, recordPageView } from "@/lib/db/queries";
import { getPropertyExtrasSafe } from "@/lib/db/units";
import { todayDateStringZagreb } from "@/lib/date";
import { UnitView } from "../UnitView";
import { stayLinks, unitFacts, unitLabel } from "../stay-shared";

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
  const title = `${unitLabel(unit, "hr")} — ${property.location}`;
  const description = [unitFacts(unit, "hr").join(" · "), property.tagline].filter(Boolean).join(" — ");
  const url = `https://www.probajnovo.com/${slug}/${unit.slug}`;
  const image = property.bannerImage || property.images[0];
  return {
    title,
    description,
    robots: { index: true, follow: true },
    icons: { icon: property.faviconUrl || "/favicon-orange.png" },
    alternates: {
      canonical: url,
      languages: { hr: url, en: `https://www.probajnovo.com/en/${slug}/${unit.slug}`, "x-default": url },
    },
    openGraph: { title, description, url, siteName: "NOVO", locale: "hr_HR", type: "website", images: image ? [{ url: image, alt: unitLabel(unit, "hr") }] : [] },
  };
}

/** Podstranica apartmana — vidi app/[slug]/UnitView.tsx i lib/db/units.ts. */
export default async function UnitPage({ params }: { params: Promise<Params> }) {
  const { slug, unit: unitSlug } = await params;
  const [property, agency] = await Promise.all([getPropertyBySlug(slug), getAgency()]);
  if (!property || !property.published) notFound();
  // Stari HR/EN linkovi na poddomeni ("/<slug>" ispred puta) → početna vikendice.
  if (unitSlug === property.slug) redirect((await stayLinks(property.slug, "hr")).home);
  const { units } = await getPropertyExtrasSafe(property.id);
  const unit = units.find((u) => u.slug === unitSlug);
  if (!unit) notFound();
  recordPageView("property", property.id, todayDateStringZagreb()).catch((err) =>
    console.error("[UnitPage] recordPageView nije uspio:", err)
  );
  return <UnitView property={property} agency={agency} unit={unit} units={units} />;
}
