import { notFound } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import { getPropertyById } from "@/lib/db/queries";
import { updatePropertyAction } from "@/lib/actions";
import { geoMissWarning } from "@/lib/geocode";
import PropertyForm from "@/components/admin/PropertyForm";
import DeletePropertyButton from "@/components/admin/DeletePropertyButton";
import PropertyUnitsEditor from "@/components/admin/PropertyUnitsEditor";
import { saveUnitsAction } from "@/lib/actions-units";
import { getPropertyExtrasSafe } from "@/lib/db/units";

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ geo?: string }>;
}) {
  await requireFullAdmin();

const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

const property = await getPropertyById(numericId);
  if (!property) notFound();

const boundAction = updatePropertyAction.bind(null, numericId);
const extras = await getPropertyExtrasSafe(numericId);
// Nazivi jedinica iz sezonskog cjenika ("Naziv (sezona)") — prijedlog za brzo dodavanje apartmana.
const suggestedNames = [
  ...new Set(
    property.seasonalPricing
      .map((sp) => sp.label.replace(/\s*\([^)]*\)\s*$/, "").trim())
      .filter(Boolean)
  ),
];

  const sp = await searchParams;
  // Postavljeno u createPropertyAction kad je adresa unesena pri kreiranju
  // ali se karta nije mogla automatski pronaći — vidi geoMissWarning.
  const initialWarning =
    sp.geo === "miss" && property.address ? geoMissWarning(property.address) : undefined;

  return (
  <div>
  <div className="flex items-center justify-between mb-6">
  <h1 className="text-xl font-bold">Uredi: {property.name}</h1>
  <DeletePropertyButton id={property.id} name={property.name} />
  </div>
  <PropertyForm
    key={`${property.id}-${property.updatedAt.getTime()}`}
    property={property}
    action={boundAction}
    submitLabel="Spremi izmjene"
    initialWarning={initialWarning}
    />
    <PropertyUnitsEditor
      action={saveUnitsAction.bind(null, numericId)}
      initialUnits={extras.units}
      initialDestination={extras.destination}
      initialTexts={extras.texts}
      location={property.location}
      suggestedNames={suggestedNames.length >= 2 ? suggestedNames : []}
      slug={property.slug}
    />
    </div>
  );
  }

