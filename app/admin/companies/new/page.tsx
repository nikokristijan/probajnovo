import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { createCompanyAction } from "@/lib/actions";
import CompanyForm from "@/components/admin/CompanyForm";

export default async function NewCompanyPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Nova firma</h1>
      <CompanyForm action={createCompanyAction} submitLabel="Objavi firmu" />
    </div>
  );
}
