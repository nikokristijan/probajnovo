import { BusinessForm } from "@/components/recenzije/app/settings/forms";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";

export const metadata = { title: "Profil tvrtke" };

const ROLE = { OWNER: "vlasnik", ADMIN: "admin", MEMBER: "član" } as const;

export default async function BusinessPage() {
  const ctx = await requireOrg();
  return (
    <>
      <PageHeader kicker="Postavke" title="Profil tvrtke" description="Kako se tvrtka prikazuje u porukama i kamo vode linkovi za recenziju." />
      <Card className="max-w-2xl">
        <CardHeader title={ctx.org.name} description={`Vaša uloga: ${ROLE[ctx.role]}`} />
        <CardBody>
          <BusinessForm org={ctx.org} canEdit={ctx.role !== "MEMBER" && !ctx.org.isDemo} />
        </CardBody>
      </Card>
    </>
  );
}
