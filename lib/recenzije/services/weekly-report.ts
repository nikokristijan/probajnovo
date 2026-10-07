import "server-only";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { activityEvents, organizationMembers, organizations, users, type ActivityType } from "@/lib/recenzije/db/schema";
import { env, integrations } from "@/lib/recenzije/env";
import { sendEmail } from "@/lib/recenzije/services/email";
import { periodReportStats } from "@/lib/recenzije/services/stats";
import { buildWeeklyReportEmail, pickRecipient, type MemberCandidate } from "@/lib/recenzije/services/weekly-report-email";

/**
 * Tjedni izvještaj vlasniku. Dedupe bez izmjene sheme: nakon slanja ostaje događaj tipa
 * "weekly_report_sent" u nr_activity_events (stupac `type` je običan text, ne enum), a nova
 * runda preskače tvrtku koja ga ima mlađeg od WEEKLY_REPORT_MIN_GAP_DAYS dana.
 *
 * Tip se u TypeScriptu zaobilazi castom jer je unija ActivityType u schema.ts (tuđa datoteka);
 * ActivityFeed ima rezervnu ikonu za nepoznate tipove, pa se događaj uredno prikaže.
 */
export const WEEKLY_REPORT_EVENT = "weekly_report_sent" as string as ActivityType;
export const WEEKLY_REPORT_WINDOW_DAYS = 7;
/** Manje od 7 da tjedni cron s malim kašnjenjem (Vercel ne garantira minutu) nikad ne preskoči tjedan. */
export const WEEKLY_REPORT_MIN_GAP_DAYS = 6;

/** Resend besplatni plan: 2 zahtjeva u sekundi. */
const SEND_PACING_MS = 600;
/** Cron ruta ima maxDuration 300 s; ostatak tvrtki ostaje za sljedeći ručni poziv. */
const DEFAULT_BUDGET_MS = 240_000;

export type WeeklyReportStatus = "sent" | "skipped" | "failed" | "would_send";

export type WeeklyReportResult = {
  organizationId: string;
  organization: string;
  status: WeeklyReportStatus;
  reason?: string;
  error?: string;
};

export type WeeklyReportRun = {
  dryRun: boolean;
  emailConfigured: boolean;
  organizations: number;
  sent: number;
  skipped: number;
  failed: number;
  wouldSend: number;
  results: WeeklyReportResult[];
};

const emailSchema = z.email();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Candidate = { organizationId: string; name: string; timezone: string; recipient: MemberCandidate };

/** Sve tvrtke osim demo s barem jednim članom, svaka s jednim primateljem (vlasnik, inače admin, inače najstariji član). */
async function reportCandidates(): Promise<Candidate[]> {
  const rows = await db
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      timezone: organizations.timezone,
      role: organizationMembers.role,
      email: users.email,
      userName: users.name,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizations)
    .innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizations.isDemo, false))
    .orderBy(asc(organizations.createdAt), asc(organizationMembers.createdAt));

  const byOrg = new Map<string, { name: string; timezone: string; members: MemberCandidate[] }>();
  for (const r of rows) {
    const entry = byOrg.get(r.organizationId) ?? { name: r.name, timezone: r.timezone, members: [] };
    entry.members.push({ role: r.role, email: r.email, name: r.userName, joinedAt: r.joinedAt });
    byOrg.set(r.organizationId, entry);
  }
  const out: Candidate[] = [];
  for (const [organizationId, o] of byOrg) {
    const recipient = pickRecipient(o.members);
    if (recipient) out.push({ organizationId, name: o.name, timezone: o.timezone, recipient });
  }
  return out;
}

function dedupeCutoff() {
  return new Date(Date.now() - WEEKLY_REPORT_MIN_GAP_DAYS * 86_400_000);
}

async function recentlyReported(organizationId: string) {
  const [row] = await db
    .select({ id: activityEvents.id })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.organizationId, organizationId),
        eq(activityEvents.type, WEEKLY_REPORT_EVENT),
        gt(activityEvents.createdAt, dedupeCutoff())
      )
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Atomarno "zauzme" tjedan: provjera i upis idu u jednoj transakciji pod advisory lockom
 * po tvrtki, pa dva istodobna poziva crona ne mogu oba poslati. Vraća id događaja ili
 * null ako je izvještaj nedavno već zabilježen.
 */
async function claimReportSlot(organizationId: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`weekly-report:${organizationId}`}))`);
    const [recent] = await tx
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.organizationId, organizationId),
          eq(activityEvents.type, WEEKLY_REPORT_EVENT),
          gt(activityEvents.createdAt, dedupeCutoff())
        )
      )
      .limit(1);
    if (recent) return null;
    const [row] = await tx
      .insert(activityEvents)
      .values({
        organizationId,
        type: WEEKLY_REPORT_EVENT,
        title: "Tjedni izvještaj poslan vlasniku",
        meta: { windowDays: WEEKLY_REPORT_WINDOW_DAYS },
      })
      .returning({ id: activityEvents.id });
    return row.id;
  });
}

/** Slanje nije uspjelo: oslobodi tjedan da sljedeći poziv može ponovno pokušati. */
async function releaseReportSlot(organizationId: string, eventId: string) {
  try {
    await db.delete(activityEvents).where(and(eq(activityEvents.id, eventId), eq(activityEvents.organizationId, organizationId)));
  } catch (e) {
    console.error("[weekly-report] oslobađanje događaja nije uspjelo", organizationId, e instanceof Error ? e.message : e);
  }
}

export async function runWeeklyReports(opts: { dryRun?: boolean; budgetMs?: number } = {}): Promise<WeeklyReportRun> {
  const dryRun = Boolean(opts.dryRun);
  const deadline = Date.now() + (opts.budgetMs ?? DEFAULT_BUDGET_MS);
  const candidates = await reportCandidates();
  const results: WeeklyReportResult[] = [];
  const push = (c: Candidate, status: WeeklyReportStatus, extra: { reason?: string; error?: string } = {}) =>
    results.push({ organizationId: c.organizationId, organization: c.name, status, ...extra });

  // Probni rad (dryRun) ništa ne šalje ni bilježi pa ne treba ključ; pravi rad bez ključa preskače sve.
  const emailConfigured = integrations.email();
  if (!emailConfigured && !dryRun) {
    for (const c of candidates) push(c, "skipped", { reason: "email_not_configured" });
    return summarize(dryRun, emailConfigured, results);
  }

  let lastSendAt = 0;
  for (const c of candidates) {
    if (Date.now() > deadline) {
      push(c, "skipped", { reason: "time_budget" });
      continue;
    }
    if (!emailSchema.safeParse(c.recipient.email).success) {
      push(c, "skipped", { reason: "invalid_recipient_email" });
      continue;
    }

    if (dryRun) {
      try {
        const recent = await recentlyReported(c.organizationId);
        push(c, recent ? "skipped" : "would_send", recent ? { reason: "already_sent_recently" } : {});
      } catch (e) {
        push(c, "failed", { error: e instanceof Error ? e.message.slice(0, 200) : "Nepoznata greška" });
      }
      continue;
    }

    let eventId: string | null = null;
    try {
      eventId = await claimReportSlot(c.organizationId);
      if (!eventId) {
        push(c, "skipped", { reason: "already_sent_recently" });
        continue;
      }
      const stats = await periodReportStats(c.organizationId, WEEKLY_REPORT_WINDOW_DAYS);
      const mail = buildWeeklyReportEmail({
        orgName: c.name,
        recipientName: c.recipient.name,
        timezone: c.timezone,
        stats,
        dashboardUrl: `${env.appUrl}/recenzije/pregled`,
        contactEmail: env.salesEmail,
      });
      const wait = SEND_PACING_MS - (Date.now() - lastSendAt);
      if (wait > 0) await sleep(wait);
      const res = await sendEmail(c.recipient.email, mail.subject, mail.html, mail.text);
      lastSendAt = Date.now();
      if (!res.ok) {
        await releaseReportSlot(c.organizationId, eventId);
        push(c, "failed", { error: res.error });
        continue;
      }
      push(c, "sent");
    } catch (e) {
      if (eventId) await releaseReportSlot(c.organizationId, eventId);
      push(c, "failed", { error: e instanceof Error ? e.message.slice(0, 200) : "Nepoznata greška" });
    }
  }
  return summarize(dryRun, emailConfigured, results);
}

function summarize(dryRun: boolean, emailConfigured: boolean, results: WeeklyReportResult[]): WeeklyReportRun {
  const n = (s: WeeklyReportStatus) => results.filter((r) => r.status === s).length;
  return {
    dryRun,
    emailConfigured,
    organizations: results.length,
    sent: n("sent"),
    skipped: n("skipped"),
    failed: n("failed"),
    wouldSend: n("would_send"),
    results,
  };
}
