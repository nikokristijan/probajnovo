import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Button } from "@/components/recenzije/ui/button";
import { db } from "@/lib/recenzije/db";
import { organizationMembers } from "@/lib/recenzije/db/schema";
import { logoutAction } from "@/lib/recenzije/actions/auth";
import { env } from "@/lib/recenzije/env";
import { getCurrentUser } from "@/lib/recenzije/session";

export const metadata = { title: "Nema pristupa" };

/**
 * Prijavljen račun koji nije povezan ni s jednom tvrtkom. Klijenti nemaju vlastiti račun ni
 * postavljanje: sve radi NOVO tim, pa je jedini izlaz javiti se NOVO-u ili se odjaviti.
 */
export default async function NoAccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/recenzije/prijava");
  // Ako tvrtka ipak postoji, ovdje nema što raditi (i sprječava petlju sa requireOrg).
  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .limit(1);
  if (membership) redirect("/recenzije/pregled");

  return (
    <div>
      <p className="label mb-3 flex items-center gap-2 text-muted">
        <span className="size-1.5 bg-orange" aria-hidden /> Pristup
      </p>
      <h1 className="text-3xl font-bold">Nema pristupa</h1>
      <p className="mt-3 text-[15px] text-muted">Vaš račun nije povezan ni s jednom tvrtkom. Javite se NOVO-u.</p>
      <p className="mt-2 text-sm text-muted">
        Pišite nam na{" "}
        <a href={`mailto:${env.salesEmail}`} className="break-all font-bold text-foreground underline underline-offset-4">
          {env.salesEmail}
        </a>
        .
      </p>
      <form action={logoutAction} className="mt-8">
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          Odjava
        </Button>
      </form>
    </div>
  );
}
