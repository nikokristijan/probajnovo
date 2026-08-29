import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import AdminForm from "@/components/admin/AdminForm";

export default async function NewAdminPage() {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");
  if (!me.isSuperAdmin) redirect("/admin");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Dodaj admina</h1>
      <AdminForm />
    </div>
  );
}
