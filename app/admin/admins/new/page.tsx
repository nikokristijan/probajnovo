import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listProperties, listCompanies } from "@/lib/db/queries";
import AdminForm from "@/components/admin/AdminForm";

export default async function NewAdminPage() {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");
  if (!me.isSuperAdmin) redirect("/admin");

  const [properties, companies] = await Promise.all([listProperties(), listCompanies()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Dodaj admina</h1>
      <AdminForm
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
