import { headers } from "next/headers";
import type { Property } from "@/lib/db/schema";
import type { PropertyUnit } from "@/lib/db/units";

/**
 * Poveznice unutar stranice vikendice koje rade i na poddomeni
 * (dukaandpiko.probajnovo.com/apartman-1) i na glavnoj domeni
 * (www.probajnovo.com/dukaandpiko/apartman-1). Na poddomeni proxy.ts
 * prepisuje "/x" → "/<slug>/x" i "/en/x" → "/en/<slug>/x".
 */
export type StayLinks = {
  home: string;
  unit: (unitSlug: string) => string;
  homeIn: (lang: "hr" | "en") => string;
  unitIn: (lang: "hr" | "en", unitSlug: string) => string;
};

export async function stayLinks(slug: string, lang: "hr" | "en"): Promise<StayLinks> {
  const apex = (process.env.NEXT_PUBLIC_APEX_HOST ?? "").toLowerCase();
  let onSubdomain = false;
  try {
    const h = await headers();
    const host = (h.get("host") || "").split(":")[0].toLowerCase();
    onSubdomain = !!apex && host === `${slug}.${apex}`;
  } catch {
    onSubdomain = false;
  }
  const hrBase = onSubdomain ? "" : `/${slug}`;
  const enBase = onSubdomain ? "/en" : `/en/${slug}`;
  const baseFor = (l: "hr" | "en") => (l === "en" ? enBase : hrBase);
  return {
    home: baseFor(lang) || "/",
    unit: (u) => `${baseFor(lang)}/${u}`,
    homeIn: (l) => baseFor(l) || "/",
    unitIn: (l, u) => `${baseFor(l)}/${u}`,
  };
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Kratki činjenični niz za apartman: "85 m² · 2 spavaće sobe · 1,5 kupaonice · do 4 gosta". */
export function unitFacts(u: PropertyUnit, lang: "hr" | "en"): string[] {
  const en = lang === "en";
  const out: string[] = [];
  if (u.sizeM2) out.push(`${u.sizeM2} m²`);
  if (u.bedrooms) {
    out.push(
      en
        ? `${u.bedrooms} bedroom${u.bedrooms === 1 ? "" : "s"}`
        : `${u.bedrooms} ${plural(u.bedrooms, "spavaća soba", "spavaće sobe", "spavaćih soba")}`
    );
  }
  if (u.bathrooms) {
    out.push(
      en
        ? `${u.bathrooms.replace(",", ".")} bathroom${u.bathrooms === "1" ? "" : "s"}`
        : `${u.bathrooms} ${u.bathrooms === "1" ? "kupaonica" : "kupaonice"}`
    );
  }
  if (u.guests) out.push(en ? `up to ${u.guests} guests` : `do ${u.guests} ${plural(u.guests, "gosta", "gosta", "gostiju")}`);
  return out;
}

/** "Duka & Piko Apartments 1 (7. i 8. mjesec)" → "Duka & Piko Apartments 1". */
export function seasonalUnitName(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim() || label;
}

/** Cijene jednog apartmana iz sezonskog cjenika (naziv ispred zagrade = naziv apartmana). */
export function unitPriceRows(property: Property, unit: PropertyUnit): { season: string; priceEur: number }[] {
  const key = unit.name.trim().toLowerCase();
  return property.seasonalPricing
    .filter((sp) => seasonalUnitName(sp.label).toLowerCase() === key)
    .map((sp) => ({ season: (sp.label.match(/\(([^)]*)\)\s*$/)?.[1] ?? "").trim(), priceEur: sp.priceEur }));
}

/** Fotografije apartmana = slike galerije čija je kategorija naziv (ili slug) apartmana. */
export function unitImages(property: Property, unit: PropertyUnit): string[] {
  const name = unit.name.trim().toLowerCase();
  return property.images.filter((src) => {
    const c = (property.imageCategories[src] ?? "").trim().toLowerCase();
    return c !== "" && (c === name || c === unit.slug);
  });
}

export function pickLang(lang: "hr" | "en", hr: string, en: string): string {
  return lang === "en" ? en || hr : hr;
}

/** Naziv apartmana za prikaz (hrvatski / engleski), s `name` kao rezervom. */
export function unitLabel(unit: PropertyUnit, lang: "hr" | "en"): string {
  return pickLang(lang, unit.label || unit.name, unit.labelEn || unit.name);
}
