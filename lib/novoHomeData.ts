import { getAgency, listProperties, listStudies, listProducts } from "@/lib/db/queries";
import type { StudyProject, ProductCard } from "@/components/NovoHome";
import type { Product } from "@/lib/db/schema";
import { saleInfo } from "@/lib/pricing";
import { todayDateStringZagreb } from "@/lib/date";

export type AgencyContact = { contactEmail: string; instagramHandle: string; city: string };

/** Kontakt podaci agencije s istim zadanim vrijednostima kao naslovnica. */
export type AgencyTracking = { metaPixelId: string | null; gaMeasurementId: string | null };

export async function getAgencyContact(): Promise<
  AgencyContact &
    AgencyTracking & {
      heroTitle: string;
      officeText: string;
      phone: string | null;
      deliveryText: string | null;
      productionText: string | null;
      guaranteeText: string | null;
    }
> {
  const agencyData = await getAgency();
  return {
    heroTitle:
      agencyData?.heroTitle ?? "NOVO je kreativni studio koji spaja brend identitet, digitalni dizajn i film.",
    officeText: agencyData?.officeText ?? "",
    contactEmail: agencyData?.contactEmail ?? "hello@novo.studio",
    instagramHandle: agencyData?.instagramHandle ?? "@novo.hr",
    city: agencyData?.city ?? "Slavonski Brod, Hrvatska",
    phone: agencyData?.phone?.trim() || null,
    metaPixelId: agencyData?.metaPixelId?.trim() || null,
    gaMeasurementId: agencyData?.gaMeasurementId?.trim() || null,
    deliveryText: agencyData?.deliveryText?.trim() || null,
    productionText: agencyData?.productionText?.trim() || null,
    guaranteeText: agencyData?.guaranteeText?.trim() || null,
  };
}

export function toProductCard(p: Product): ProductCard {
  const sale = saleInfo(p, todayDateStringZagreb());
  return {
    salePercent: sale.percent,
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    priceEur: sale.price,
    images: p.images,
    features: p.features,
    slug: p.slug,
    featured: p.featured,
    category: p.category,
  };
}

/**
 * Sve što NovoHome treba — dijele ga naslovnica (/) i /proizvodi, koji je
 * ista stranica otvorena na tabu PROIZVODI (ali s vlastitim URL-om).
 */
export async function loadNovoHomeData() {
  const [contact, propertiesData, studiesData, productsData] = await Promise.all([
    getAgencyContact(),
    listProperties({ onlyPublished: true }),
    listStudies({ onlyPublished: true }),
    listProducts({ onlyPublished: true }),
  ]);

  const propertyProjects: StudyProject[] = propertiesData
    .filter((p) => p.showInStudies)
    .map((p) => {
      const gallery = p.bannerImage ? [p.bannerImage, ...p.images] : p.images;
      return {
        id: p.id,
        kind: "vikendica",
        slug: p.slug,
        name: p.name,
        location: p.location,
        tagline: p.tagline,
        description: p.description,
        year: p.createdAt.getFullYear(),
        images: gallery,
        contactEmail: p.contactEmail || contact.contactEmail,
      };
    });

  // +1_000_000 na id da se nikad ne poklopi s properties.id (obje tablice
  // kreću brojanje od 1) — id se koristi kao React key i za prepoznavanje
  // već otvorenog pop-up prozora.
  const studyProjects: StudyProject[] = studiesData.map((s) => ({
    id: s.id + 1_000_000,
    kind: "study",
    name: s.title,
    location: s.category,
    tagline: s.tagline,
    description: s.description,
    year: s.year,
    images: s.images,
    externalUrl: s.externalUrl || undefined,
  }));

  return {
    ...contact,
    projects: [...propertyProjects, ...studyProjects],
    products: productsData.map(toProductCard),
  };
}
