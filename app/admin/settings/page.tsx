import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";

export default async function AdminSettingsPage() {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold">Postavke</h1>
        <p className="text-xs text-black/50 mt-0.5">Prijavljen kao {me.email}</p>
      </div>

      <div className="border border-black/10 rounded-xl p-5 flex flex-col gap-4 bg-black/[0.02] max-w-sm">
        <span className="text-sm font-semibold">Promijeni lozinku</span>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
