import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, organizations } from "@/lib/recenzije/db/schema";

/**
 * Je li broj odjavljen kod ijedne (ne-demo) tvrtke. Svi klijenti dijele isti NOVO pošiljatelj, a odjava
 * (STOP ili poveznica /o/<token>) vrijedi za sve tvrtke. optOutPhoneEverywhere (inbound.ts) to radi za
 * klijente koji već postoje; ovo pokriva zapise koji nastanu KASNIJE (novi klijent ili promijenjen broj),
 * da ih druga tvrtka ne uvede ponovno u slanje. Vraća samo da/ne, nikad koja je tvrtka u pitanju.
 */
export async function isNumberOptedOut(phone: string): Promise<boolean> {
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .innerJoin(organizations, eq(organizations.id, clients.organizationId))
    .where(and(eq(clients.phone, phone), eq(clients.smsOptOut, true), eq(organizations.isDemo, false)))
    .limit(1);
  return Boolean(row);
}
