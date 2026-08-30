import { redirect, notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { getPropertyById } from "@/lib/db/queries";
import { updatePropertyAction } from "@/lib/actions";
import PropertyForm from "@/components/admin/PropertyForm";
import DeletePropertyButton from "@/components/admin/DeletePropertyButton";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

const property = await getPropertyById(numericId);
  if (!property) notFound();

const boundAction = updatePropertyAction.bind(null, numericId);

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
  />
  </div>
  );
  }
  
