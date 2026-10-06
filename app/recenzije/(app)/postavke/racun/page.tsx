import { AccountForm } from "@/components/recenzije/app/settings/forms";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";

export const metadata = { title: "Račun" };

const ROLE = { OWNER: "vlasnik", ADMIN: "admin", MEMBER: "član" } as Record<string, string>;

export default async function AccountPage() {
  const ctx = await requireOrg();
  return (
    <>
      <PageHeader kicker="Postavke" title="Račun" description="Vaši podaci za prijavu." />
      <Card className="max-w-2xl">
        <CardHeader title="Profil" />
        <CardBody>
          <AccountForm name={ctx.user.name ?? ""} email={ctx.user.email} hasPassword={!!ctx.user.passwordHash} />
        </CardBody>
      </Card>
      <Card className="mt-4 max-w-2xl">
        <CardHeader title="Tvrtke" description="Tvrtke kojima pripadate. Podaci se nikad ne miješaju između njih." />
        <CardBody>
          <ul className="divide-y divide-border text-sm">
            {ctx.memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5">
                <span>{m.name}</span>
                <span className="label text-muted">{ROLE[m.role] ?? m.role}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}
