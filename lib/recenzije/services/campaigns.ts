import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { automationRuns, campaigns, clients, type CampaignAudience } from "@/lib/recenzije/db/schema";
import { enrollInCampaign, processRun } from "./automation-engine";

/** Clients matching a campaign audience: latest service within N days, status, optional service name. */
export async function audienceClients(organizationId: string, a: CampaignAudience) {
  const conds = [eq(clients.organizationId, organizationId), eq(clients.smsOptOut, false)];
  if (a.statuses.length) conds.push(inArray(clients.reviewStatus, a.statuses));
  const days = Math.max(1, Math.min(3650, a.serviceWithinDays || 30));
  return db
    .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(
      and(
        ...conds,
        sql`exists (
          select 1 from nr_services s where s.client_id = "nr_clients"."id"
          and s.service_date >= now() - (${days} || ' days')::interval
          ${a.service ? sql`and s.name = ${a.service}` : sql``}
        )`
      )
    )
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
        failed++;
        firstError ||= r.error ?? "";
      }
    }
  }
  return { enrolled: runIds.length, audience: audience.length, failed, firstError };
}
