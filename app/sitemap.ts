import type { MetadataRoute } from "next";
import { listProperties, listCompanies, listProducts } from "@/lib/db/queries";

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
  const [properties, companies, products] = await Promise.all([
    listProperties({ onlyPublished: true }),
    listCompanies({ onlyPublished: true }),
    listProducts({ onlyPublished: true }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/proizvodi`, changeFrequency: "weekly", priority: 0.7 },
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

  const productEntries: MetadataRoute.Sitemap = products
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${BASE_URL}/proizvodi/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [...staticEntries, ...propertyEntries, ...companyEntries, ...productEntries];
}
