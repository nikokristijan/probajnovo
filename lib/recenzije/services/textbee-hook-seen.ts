import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { hasOwnTextbee, optOutLinkFor, type OrgSms } from "./sms";

/**
 * Je li za TextBee mobitel tvrtke stigao barem jedan ispravno potpisan webhook događaj (nr_meta ključ textbee_hook_seen:<id>,
 * piše ga textbee-webhook.ts, briše ga novi/uklonjeni mobitel i nova tajna). Tek tada odgovori (STOP) sigurno stižu do nas,
 * pa poruke s mobitela tvrtke smiju završiti uputom "Za odjavu napišite STOP.". Dotad nose poveznicu za odjavu.
 */
export const textbeeHookSeenKey = (organizationId: string) => `textbee_hook_seen:${organizationId}`;

export async function isTextbeeHookSeen(organizationId: string): Promise<boolean> {
  const rows = await db.execute<{ value: string }>(sql`select value from nr_meta where key = ${textbeeHookSeenKey(organizationId)} limit 1`);
  return Array.from(rows).length > 0;
}

/**
 * Treba li poruka ove tvrtke poveznicu za odjavu: isto što optOutLinkFor, ali za TextBee mobitel tvrtke uz stvarno stanje webhooka
 * (čita se samo kad tvrtka ima vlastiti TextBee). Jedino mjesto koje odlučuje o odjavi u poruci za slanje i pregled.
 */
export async function optOutLinkForOrg(org: OrgSms & { id: string }): Promise<boolean> {
  return optOutLinkFor(org, hasOwnTextbee(org) ? await isTextbeeHookSeen(org.id) : false);
}
