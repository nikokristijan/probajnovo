import type { MetadataRoute } from "next";
import { listProperties, listCompanies } from "@/lib/db/queries";

/**
 * Kanonska domena za sitemap URL-ove. Namjerno "www" varijanta jer
 * probajnovo.com (apex) trenutno 308-redirecta na www.probajnovo.com —
 * bolje uputiti tražilice izravno na krajnju adresu nego kroz redirect.
 */
const BASE_URL = "https://www.probajnovo.com";

/**
 * Dinamički generirana sitemap.xml — uključuje sve OBJAVLJENE vikendice i
 * firme automatski, bez ručnog ažuriranja pri svakom novom unosu. Skriveni
 * (neobjavljeni) unosi se namjerno izostavljaju.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [properties, companies] = await Promise.all([
    listProperties({ onlyPublished: true }),
    listCompanies({ onlyPublished: true }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
  ];

  const propertyEntries: MetadataRoute.Sitemap = properties.map((p) => ({
    url: `${BASE_URL}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const companyEntries: MetadataRoute.Sitemap = companies.map((c) => ({
    url: `${BASE_URL}/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...propertyEntries, ...companyEntries];
}
