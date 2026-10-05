import { redirect } from "next/navigation";
import NovoHome from "@/components/NovoHome";
import { loadNovoHomeData } from "@/lib/novoHomeData";

export const revalidate = 0; // uvijek svježe iz baze (admin izmjene odmah vidljive)

const VALID_VIEWS = new Set(["home", "studies", "office"]);

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  // Stari linkovi na "/?view=products" — proizvodi sad imaju svoju adresu.
  if (view === "products") redirect("/proizvodi");
  const initialView = VALID_VIEWS.has(view ?? "") ? (view as "home" | "studies" | "office") : undefined;

  const data = await loadNovoHomeData();

  return (
    <NovoHome
      heroTitle={data.heroTitle}
      officeText={data.officeText}
      contactEmail={data.contactEmail}
      instagramHandle={data.instagramHandle}
      city={data.city}
      projects={data.projects}
      products={data.products}
      initialView={initialView}
    />
  );
}
