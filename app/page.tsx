import { getAgency, listProperties } from "@/lib/db/queries";
import NovoHome, { type StudyProject } from "@/components/NovoHome";

export const revalidate = 0; // uvijek svježe iz baze (admin izmjene odmah vidljive)

export default async function HomePage() {
  const [agencyData, propertiesData] = await Promise.all([
    getAgency(),
    listProperties({ onlyPublished: true }),
  ]);

  const heroTitle =
    agencyData?.heroTitle ??
    "NOVO is a creative agency working across brand identity, digital design, and film.";
  const officeText = agencyData?.officeText ?? "";
  const agencyContactEmail = agencyData?.contactEmail ?? "hello@novo.studio";
  const instagramHandle = agencyData?.instagramHandle ?? "@novo.hr";
  const city = agencyData?.city ?? "Slavonski Brod, Croatia";

  const projects: StudyProject[] = propertiesData.map((p) => {
    const gallery = p.bannerImage ? [p.bannerImage, ...p.images] : p.images;
    return {
      id: p.id,
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
