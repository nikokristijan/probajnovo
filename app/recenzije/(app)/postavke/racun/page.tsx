import { redirect } from "next/navigation";
import { AccountForm } from "@/components/recenzije/app/settings/forms";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/recenzije/ui/primitives";
import { OPERATOR_EMAIL } from "@/lib/recenzije/operator";
import { requireOrg } from "@/lib/recenzije/session";

export const metadata = { title: "Račun" };

/** Samo za stare korisnike s lozinkom. NOVO tim (operater) i primjer nemaju račun za uređivanje. */
export default async function AccountPage() {
  const ctx = await requireOrg();
  if (ctx.user.email === OPERATOR_EMAIL || ctx.org.isDemo) redirect("/recenzije/postavke");
  return (
    <>
      <PageHeader kicker="Postavke" title="Račun" description="Podaci za prijavu." />
      <Card className="max-w-2xl">
        <CardHeader title="Profil" />
        <CardBody>
          <AccountForm name={ctx.user.name ?? ""} email={ctx.user.email} hasPassword={!!ctx.user.passwordHash} />
        </CardBody>
      </Card>
    </>
  );
}
