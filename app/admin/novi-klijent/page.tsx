import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import ClientWizardForm from "@/components/admin/ClientWizardForm";

/** Čarobnjak za novog klijenta (plan #12) — samo glavni admin. */
export default async function NewClientPage() {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");
  if (!me.isSuperAdmin) redirect("/admin");
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Novi klijent</h1>
        <p className="text-sm text-black/60 mt-0.5">
          Stranica, pretplata i vlasnik u jednom koraku. Stranica ostaje skrivena dok je ne popuniš i objaviš.
        </p>
      </div>
      <ClientWizardForm />
    </div>
  );
}
