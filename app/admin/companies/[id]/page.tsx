import { notFound } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import { getCompanyById } from "@/lib/db/queries";
import { updateCompanyAction } from "@/lib/actions";
import CompanyForm from "@/components/admin/CompanyForm";
import DeleteCompanyButton from "@/components/admin/DeleteCompanyButton";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFullAdmin();

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const company = await getCompanyById(numericId);
  if (!company) notFound();

  const boundAction = updateCompanyAction.bind(null, numericId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Uredi: {company.name}</h1>
        <DeleteCompanyButton id={company.id} name={company.name} />
      </div>
      <CompanyForm
        key={`${company.id}-${company.updatedAt.getTime()}`}
        company={company}
        action={boundAction}
        submitLabel="Spremi izmjene"
      />
    </div>
  );
}
