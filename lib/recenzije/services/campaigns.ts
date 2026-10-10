import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { automationRuns, campaigns, clients, type CampaignAudience } from "@/lib/recenzije/db/schema";
import { NO_CONSENT_ERROR, QUIET_HOURS_ERROR } from "@/lib/recenzije/menu-send-rules";
import { enrollInCampaign, processRun } from "./automation-engine";

/**
 * Clients matching a campaign audience: latest service within N days, status, optional service name.
 * Gosti s jelovnika (source "menu") bez usluge ulaze samo ako su pristali na obavijesti (nr_menu_guests.notices_consent) i
 * ako su unijeli broj unutar N dana; kampanja za određenu uslugu ih ne obuhvaća. Gost bez te privole nikad nije u publici.
 */
export async function audienceClients(organizationId: string, a: CampaignAudience) {
  const conds = [eq(clients.organizationId, organizationId), eq(clients.smsOptOut, false)];
  if (a.statuses.length) conds.push(inArray(clients.reviewStatus, a.statuses));
  const days = Math.max(1, Math.min(3650, a.serviceWithinDays || 30));
  const withService = sql`exists (
    select 1 from nr_services s where s.client_id = "nr_clients"."id"
    and s.service_date >= now() - (${days} || ' days')::interval
    ${a.service ? sql`and s.name = ${a.service}` : sql``}
  )`;
  const consentedGuest = a.service
    ? sql`false`
    : sql`(${clients.source} = 'menu' and exists (
        select 1 from nr_menu_guests g
        where g.organization_id = ${clients.organizationId} and g.client_id = ${clients.id} and g.notices_consent = true
        and g.created_at >= now() - (${days} || ' days')::interval
      ))`;
  return db
    .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(and(...conds, sql`(${withService} or ${consentedGuest})`))
    .limit(2000);
}

export async function launchCampaign(organizationId: string, campaignId: string) {
  const [c] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.organizationId, organizationId)))
    .limit(1);
  if (!c) throw new Error("Kampanja nije pronađena");
  await db
    .update(campaigns)
    .set({ status: "ACTIVE", launchedAt: c.launchedAt ?? new Date() })
    .where(eq(campaigns.id, c.id));
  const audience = await audienceClients(organizationId, c.audience);
  const runIds: string[] = [];
  for (const cl of audience) {
    const id = await enrollInCampaign(c.id, organizationId, cl.id, null);
    if (id) runIds.push(id);
  }
  // Without a delay the first message goes out now; otherwise the cron worker sends it later.
  let failed = 0;
  let skipped = 0;
  let firstError = "";
  for (const id of runIds) {
    await processRun(id);
  }
  if (runIds.length) {
    const rows = await db
      .select({ status: automationRuns.status, error: automationRuns.error })
      .from(automationRuns)
      .where(inArray(automationRuns.id, runIds));
    for (const r of rows) {
      if (r.status === "FAILED") {
        // Gost s jelovnika kojem poruka nije smjela otići (noćna pauza, nema privole): preskočen, ne greška.
        if (r.error === NO_CONSENT_ERROR || r.error === QUIET_HOURS_ERROR) skipped++;
        else {
          failed++;
          firstError ||= r.error ?? "";
        }
      }
    }
  }
  return { enrolled: runIds.length, audience: audience.length, failed, skipped, firstError };
}
