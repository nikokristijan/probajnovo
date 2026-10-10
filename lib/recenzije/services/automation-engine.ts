import "server-only";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import {
  automationRuns,
  automations,
  campaigns,
  clients,
  organizations,
  services,
  type AutomationRun,
  type RunLogEntry,
} from "@/lib/recenzije/db/schema";
import { VENUE_REVIEW_TEMPLATE_KEY } from "@/lib/recenzije/automation/templates";
import type { AutomationStep } from "@/lib/recenzije/automation/types";
import { isQuietHour, safeTimeZone, shiftOutOfQuietHours } from "@/lib/recenzije/quiet-hours";
import { fullName } from "@/lib/recenzije/utils";
import { logActivity } from "./activity";
import { sendClientMessage } from "./messaging";

const MAX_STEPS_PER_TICK = 20;
/**
 * Poruka gostu s jelovnika koja je kasnila više od ovoga (cron nije radio, nitko nije otvorio stranicu) više se ne
 * šalje: "Hvala što ste svratili" nakon dva dana je neugodna, a privola je bila za poruku otprilike sat i pol nakon posjeta.
 */
export const VENUE_MAX_LATE_MS = 24 * 60 * 60_000;
const TRIGGER_TEXT = { SERVICE_COMPLETED: "završena usluga", CLIENT_CREATED: "novi klijent", MANUAL: "ručno" } as const;

function entry(stepIndex: number, type: string, message: string): RunLogEntry {
  return { at: new Date().toISOString(), stepIndex, type, message };
}

/** Starts a run of every enabled automation with this trigger for the client. */
export async function triggerAutomations(input: {
  organizationId: string;
  trigger: "SERVICE_COMPLETED" | "CLIENT_CREATED" | "MANUAL";
  clientId: string;
  serviceId?: string | null;
  automationId?: string;
}) {
  const conds = [
    eq(automations.organizationId, input.organizationId),
    eq(automations.enabled, true),
    eq(automations.trigger, input.trigger),
  ];
  if (input.automationId) conds.push(eq(automations.id, input.automationId));
  const list = await db.select().from(automations).where(and(...conds));

  const runIds: string[] = [];
  for (const a of list) {
    // Don't start a second concurrent run of the same automation for the same client.
    const [active] = await db
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.automationId, a.id),
          eq(automationRuns.clientId, input.clientId),
          inArray(automationRuns.status, ["RUNNING", "WAITING"])
        )
      )
      .limit(1);
    if (active) continue;
    const [run] = await db
      .insert(automationRuns)
      .values({
        organizationId: input.organizationId,
        automationId: a.id,
        clientId: input.clientId,
        serviceId: input.serviceId ?? null,
        status: "RUNNING",
        nextRunAt: new Date(),
        log: [entry(0, "trigger", `Pokrenuto: ${TRIGGER_TEXT[input.trigger]}`)],
      })
      .returning();
    runIds.push(run.id);
  }
  // Ongoing campaigns enroll new completed jobs that match their service filter.
  if (input.trigger === "SERVICE_COMPLETED" && !input.automationId) {
    const active = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.organizationId, input.organizationId), eq(campaigns.status, "ACTIVE"), eq(campaigns.trigger, "SERVICE_COMPLETED")));
    let serviceName: string | null = null;
    if (input.serviceId) {
      const [svc] = await db.select({ name: services.name }).from(services).where(eq(services.id, input.serviceId)).limit(1);
      serviceName = svc?.name ?? null;
    }
    for (const c of active) {
      if (c.audience.service && c.audience.service !== serviceName) continue;
      const id = await enrollInCampaign(c.id, input.organizationId, input.clientId, input.serviceId ?? null);
      if (id) runIds.push(id);
    }
  }
  // Execute immediate steps right away; waits are picked up by the cron worker.
  for (const id of runIds) await processRun(id);
  return runIds;
}

/** Creates a campaign run for a client unless one is already active (or the client already got this campaign). */
export async function enrollInCampaign(campaignId: string, organizationId: string, clientId: string, serviceId: string | null) {
  const [existing] = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(and(eq(automationRuns.campaignId, campaignId), eq(automationRuns.clientId, clientId)))
    .limit(1);
  if (existing) return null;
  const [run] = await db
    .insert(automationRuns)
    .values({
      organizationId,
      campaignId,
      clientId,
      serviceId,
      status: "RUNNING",
      nextRunAt: new Date(),
      log: [entry(0, "trigger", "Dodano u kampanju")],
    })
    .returning();
  return run.id;
}

/** Campaign launch creates one run per audience client with campaign-defined steps. */
export function campaignSteps(c: typeof campaigns.$inferSelect): AutomationStep[] {
  const steps: AutomationStep[] = [];
  if (c.delayMinutes > 0) steps.push({ id: "c-wait", type: "wait", minutes: c.delayMinutes });
  steps.push({ id: "c-send", type: "send_review_request", template: c.messageBody });
  if (c.followUpEnabled && c.followUpBody) {
    steps.push({ id: "c-wait2", type: "wait", minutes: c.followUpAfterHours * 60 });
    steps.push({ id: "c-cond", type: "condition", check: "reviewed", ifTrue: "end", ifFalse: "continue" });
    steps.push({ id: "c-follow", type: "send_follow_up", template: c.followUpBody });
  }
  return steps;
}

type RunPlan = { steps: AutomationStep[]; /** Automatizacija jelovnika: za nju vrijedi noćna pauza. */ venue: boolean; enabled: boolean };

async function planForRun(run: AutomationRun): Promise<RunPlan | null> {
  if (run.automationId) {
    const [a] = await db.select().from(automations).where(eq(automations.id, run.automationId)).limit(1);
    return a ? { steps: a.steps, venue: a.templateKey === VENUE_REVIEW_TEMPLATE_KEY, enabled: a.enabled } : null;
  }
  if (run.campaignId) {
    const [c] = await db.select().from(campaigns).where(eq(campaigns.id, run.campaignId)).limit(1);
    return c ? { steps: campaignSteps(c), venue: false, enabled: true } : null;
  }
  return null;
}

/**
 * Advances a run until it has to wait, finishes, or fails. Safe to call
 * repeatedly: a run is claimed with an UPDATE … WHERE status/nextRunAt guard so
 * two workers can't execute the same step.
 */
export async function processRun(runId: string, now: Date = new Date()): Promise<void> {
  const [claimed] = await db
    .update(automationRuns)
    .set({ status: "RUNNING" })
    .where(
      and(
        eq(automationRuns.id, runId),
        inArray(automationRuns.status, ["RUNNING", "WAITING"]),
        lte(automationRuns.nextRunAt, now)
      )
    )
    .returning();
  if (!claimed) return;

  const run = claimed;
  const plan = await planForRun(run);
  const steps = plan?.steps ?? null;
  const log: RunLogEntry[] = [...(run.log ?? [])];
  let index = run.stepIndex;

  const finish = async (status: "COMPLETED" | "FAILED" | "CANCELLED", error?: string) => {
    await db
      .update(automationRuns)
      .set({ status, stepIndex: index, log, finishedAt: new Date(), error: error ?? null })
      .where(eq(automationRuns.id, run.id));
  };

  if (!steps) {
    log.push(entry(index, "error", "Automatizacija više ne postoji"));
    return finish("CANCELLED");
  }

  // Jelovnik: isključena automatizacija ne šalje, kasno pokretanje se ne šalje, a noću se čeka do 09:00.
  if (plan?.venue) {
    if (!plan.enabled) {
      log.push(entry(index, "end", "Automatizacija je isključena, poruka se ne šalje"));
      return finish("CANCELLED");
    }
    if (now.getTime() - run.nextRunAt.getTime() > VENUE_MAX_LATE_MS) {
      log.push(entry(index, "error", "Prekasno za slanje: poruka je trebala otići prije više od 24 sata"));
      return finish("CANCELLED");
    }
    const [org] = await db.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, run.organizationId)).limit(1);
    const tz = safeTimeZone(org?.timezone);
    if (isQuietHour(now, tz)) {
      const resumeAt = shiftOutOfQuietHours(now, tz);
      log.push(entry(index, "wait", `Noćna pauza (22:00 do 09:00): slanje je pomaknuto na ${resumeAt.toISOString()}`));
      await db.update(automationRuns).set({ status: "WAITING", nextRunAt: resumeAt, log }).where(eq(automationRuns.id, run.id));
      return;
    }
  }

  // Paused campaigns / disabled automations hold their runs instead of sending.
  if (run.campaignId) {
    const [c] = await db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, run.campaignId)).limit(1);
    if (c?.status === "PAUSED" || c?.status === "DRAFT") {
      await db
        .update(automationRuns)
        .set({ status: "WAITING", nextRunAt: new Date(Date.now() + 60 * 60_000) })
        .where(eq(automationRuns.id, run.id));
      return;
    }
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, run.clientId), eq(clients.organizationId, run.organizationId)))
    .limit(1);
  if (!client) {
    log.push(entry(index, "error", "Klijent je obrisan"));
    return finish("CANCELLED");
  }

  for (let guard = 0; guard < MAX_STEPS_PER_TICK; guard++) {
    if (index >= steps.length) {
      log.push(entry(index, "end", "Tijek završen"));
      await logActivity({
        organizationId: run.organizationId,
        clientId: client.id,
        type: "automation_completed",
        title: `Automatizacija završena: ${fullName(client)}`,
      });
      return finish("COMPLETED");
    }
    const step = steps[index];

    if (step.type === "wait") {
      // A wait is "consumed" when we come back after nextRunAt; mark by advancing first.
      const resumeAt = new Date(Date.now() + step.minutes * 60_000);
      index++;
      log.push(entry(index - 1, "wait", `Čeka do ${resumeAt.toISOString()}`));
      // Show "follow-up scheduled" on the client when the next real action is a follow-up.
      const upcomingFollowUp = steps.slice(index).find((s) => s.type !== "condition" && s.type !== "wait");
      if (upcomingFollowUp?.type === "send_follow_up" && !["REVIEW_RECEIVED", "COMPLETED"].includes(client.reviewStatus)) {
        await db
          .update(clients)
          .set({
            nextFollowUpAt: resumeAt,
            // Only a client who hasn't engaged yet moves to "follow-up scheduled"; CLICKED is more informative.
            ...(client.reviewStatus === "REQUEST_SENT" ? { reviewStatus: "FOLLOW_UP_SCHEDULED" as const } : {}),
          })
          .where(eq(clients.id, client.id));
        await logActivity({
          organizationId: run.organizationId,
          clientId: client.id,
          type: "follow_up_scheduled",
          title: `Zakazan podsjetnik: ${fullName(client)}`,
          meta: { at: resumeAt.toISOString() },
        });
      }
      await db
        .update(automationRuns)
        .set({ status: "WAITING", stepIndex: index, nextRunAt: resumeAt, log })
        .where(eq(automationRuns.id, run.id));
      return;
    }

    if (step.type === "condition") {
      const [fresh] = await db.select().from(clients).where(eq(clients.id, client.id)).limit(1);
      const status = fresh?.reviewStatus ?? client.reviewStatus;
      const reviewed = status === "REVIEW_RECEIVED" || status === "COMPLETED";
      const result = step.check === "reviewed" ? reviewed : status === "CLICKED" || reviewed;
      const action = result ? step.ifTrue : step.ifFalse;
      log.push(entry(index, "condition", `${step.check === "clicked" ? "Kliknuo link" : "Ostavio recenziju"}? ${result ? "Da" : "Ne"} → ${action === "end" ? "kraj" : "nastavi"}`));
      if (action === "end") {
        if (fresh && !["REVIEW_RECEIVED", "COMPLETED"].includes(fresh.reviewStatus)) {
          await db.update(clients).set({ nextFollowUpAt: null }).where(eq(clients.id, client.id));
        }
        index = steps.length;
        continue;
      }
      index++;
      continue;
    }

    // Sending steps.
    const kind =
      step.type === "send_review_request"
        ? run.campaignId
          ? "CAMPAIGN"
          : "REVIEW_REQUEST"
        : step.type === "send_follow_up"
          ? "FOLLOW_UP"
          : "MANUAL";
    const out = await sendClientMessage({
      organizationId: run.organizationId,
      clientId: client.id,
      template: step.template,
      kind,
      campaignId: run.campaignId,
      automationRunId: run.id,
    });
    if (!out.ok) {
      log.push(entry(index, step.type, `Neuspjelo: ${out.error}`));
      index++;
      return finish("FAILED", out.error);
    }
    log.push(entry(index, step.type, "Poruka poslana"));
    // Keep the in-memory copy in sync with what messaging just wrote.
    if (step.type !== "send_message" && ["NOT_CONTACTED", "FOLLOW_UP_SCHEDULED"].includes(client.reviewStatus)) {
      client.reviewStatus = "REQUEST_SENT";
    }
    index++;
  }

  // Safety valve against malformed step lists.
  await db
    .update(automationRuns)
    .set({ status: "WAITING", stepIndex: index, nextRunAt: new Date(Date.now() + 60_000), log })
    .where(eq(automationRuns.id, run.id));
}

/** Called by /api/recenzije/cron/automations. Processes runs whose wait has elapsed. */
export async function processDueRuns(limit = 50, now: Date = new Date()) {
  const due = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(
      and(
        inArray(automationRuns.status, ["RUNNING", "WAITING"]),
        lte(automationRuns.nextRunAt, now),
        // Demo workspaces never send; their sample runs stay as seeded.
        sql`not exists (select 1 from nr_organizations o where o.id = "nr_automation_runs"."organization_id" and o.is_demo)`
      )
    )
    .orderBy(asc(automationRuns.nextRunAt))
    .limit(limit);
  let processed = 0;
  for (const r of due) {
    try {
      await processRun(r.id, now);
      processed++;
    } catch (e) {
      await db
        .update(automationRuns)
        .set({ status: "FAILED", error: e instanceof Error ? e.message : String(e), finishedAt: new Date() })
        .where(eq(automationRuns.id, r.id));
    }
  }
  return { due: due.length, processed };
}

/** Stops every active run for a client (used when a review arrives). */
export async function cancelActiveRunsForClient(organizationId: string, clientId: string, reason: string) {
  const active = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.organizationId, organizationId),
        eq(automationRuns.clientId, clientId),
        inArray(automationRuns.status, ["RUNNING", "WAITING"])
      )
    );
  for (const r of active) {
    await db
      .update(automationRuns)
      .set({
        status: "COMPLETED",
        finishedAt: new Date(),
        log: sql`${automationRuns.log} || ${JSON.stringify([entry(r.stepIndex, "end", reason)])}::jsonb`,
      })
      .where(eq(automationRuns.id, r.id));
  }
}
