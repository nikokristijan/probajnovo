import { getAgency, listProperties, listStudies } from "@/lib/db/queries";
import NovoHome, { type StudyProject } from "@/components/NovoHome";

export const revalidate = 0; // uvijek svježe iz baze (admin izmjene odmah vidljive)

export default async function HomePage() {
  const [agencyData, propertiesData, studiesData] = await Promise.all([
    getAgency(),
    listProperties({ onlyPublished: true }),
    listStudies({ onlyPublished: true }),
  ]);

  const heroTitle =
    agencyData?.heroTitle ??
    "NOVO is a creative agency working across brand identity, digital design, and film.";
  const officeText = agencyData?.officeText ?? "";
  const agencyContactEmail = agencyData?.contactEmail ?? "hello@novo.studio";
  const instagramHandle = agencyData?.instagramHandle ?? "@novo.hr";
  const city = agencyData?.city ?? "Slavonski Brod, Croatia";

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
        contactEmail: p.contactEmail || agencyContactEmail,
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

  const projects: StudyProject[] = [...propertyProjects, ...studyProjects];

  return (
    <NovoHome
      heroTitle={heroTitle}
      officeText={officeText}
      contactEmail={agencyContactEmail}
      instagramHandle={instagramHandle}
      city={city}
      projects={projects}
    />
  );
}
