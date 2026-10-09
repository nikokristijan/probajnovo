import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, organizations, trackingLinks, type Client } from "@/lib/recenzije/db/schema";
import { optOutClient, optOutPhoneEverywhere } from "./inbound";

/**
 * Odjava poveznicom iz SMS-a (/o/<token>). Preko Twilija odgovori u Hrvatskoj ne stižu do nas, pa je poveznica
 * jedini siguran put odjave. Token je isti kao u /r/<token> poveznici klijenta: nr_tracking_links veže token
 * na klijenta i tvrtku. Neispravan, nepoznat i demo token izvana izgledaju jednako ("poveznica ne vrijedi"),
 * da stranica ne otkriva postoji li klijent.
 */

export const OPT_OUT_TOKEN = /^[A-Za-z0-9]{6,32}$/;

export type OptOutLookup = { valid: false } | { valid: true; businessName: string; optedOut: boolean };

type Resolved = { client: Client; businessName: string };

async function resolve(token: string): Promise<Resolved | null> {
  if (!OPT_OUT_TOKEN.test(token)) return null;
  const [row] = await db
    .select({ client: clients, linkOrganizationId: trackingLinks.organizationId, businessName: organizations.name, isDemo: organizations.isDemo })
    .from(trackingLinks)
    .innerJoin(clients, eq(clients.id, trackingLinks.clientId))
    .innerJoin(organizations, eq(organizations.id, trackingLinks.organizationId))
    .where(eq(trackingLinks.token, token))
    .limit(1);
  // Klijent mora pripadati istoj tvrtki kao poveznica (tenant izolacija), a demo se ne mijenja.
  if (!row || row.isDemo || row.client.organizationId !== row.linkOrganizationId) return null;
  return { client: row.client, businessName: row.businessName };
}

/** Samo čitanje (GET stranice): ne mijenja ništa, da skeneri poveznica ne mogu odjaviti klijenta. */
export async function lookupOptOut(token: string): Promise<OptOutLookup> {
  const r = await resolve(token);
  return r ? { valid: true, businessName: r.businessName, optedOut: r.client.smsOptOut } : { valid: false };
}

/**
 * Odjavljuje klijenta kao da je odgovorio STOP (isti optOutClient: smsOptOut, aktivnost, otkazani
 * podsjetnici), a isti broj odjavljuje i u ostalim tvrtkama koje šalju preko zajedničkog NOVO pošiljatelja.
 * Idempotentno: ponovljen poziv ne udvostručuje zapise.
 */
export async function optOutByToken(token: string): Promise<{ ok: boolean; businessName?: string }> {
  const r = await resolve(token);
  if (!r) return { ok: false };
  const reason = "Klijent se odjavio poveznicom";
  await optOutClient(r.client, reason);
  await optOutPhoneEverywhere([r.client.phone], { reason, exceptClientId: r.client.id });
  return { ok: true, businessName: r.businessName };
}
