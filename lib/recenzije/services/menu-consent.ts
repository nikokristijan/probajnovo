import "server-only";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, menuGuests } from "@/lib/recenzije/db/schema";

/**
 * Je li klijent (gost s jelovnika) pristao na obavijesti: barem jedan njegov unos kod ove tvrtke ima notices_consent = true.
 * Unosi stariji od 12 mjeseci se brišu (purgeOldGuestData), pa privola istječe zajedno s brojem.
 */
export async function hasNoticesConsent(organizationId: string, clientId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: menuGuests.id })
    .from(menuGuests)
    .where(and(eq(menuGuests.organizationId, organizationId), eq(menuGuests.clientId, clientId), eq(menuGuests.noticesConsent, true)))
    .limit(1);
  return Boolean(row);
}

/** Isto kao hasNoticesConsent, kao SQL uvjet nad tablicom nr_clients (za popise i publike). */
export const clientHasNoticesConsentSql: SQL<boolean> = sql<boolean>`exists (
  select 1 from nr_menu_guests g
  where g.organization_id = ${clients.organizationId} and g.client_id = ${clients.id} and g.notices_consent = true
)`;
