import "server-only";
import { and, asc, eq, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { activityEvents, organizationMembers, organizations, users, type ActivityType } from "@/lib/recenzije/db/schema";
import { env, integrations } from "@/lib/recenzije/env";
import { OPERATOR_EMAIL } from "@/lib/recenzije/operator";
import { usage } from "@/lib/recenzije/services/billing";
import { sendEmail } from "@/lib/recenzije/services/email";
import { periodReportStats } from "@/lib/recenzije/services/stats";
import { buildWeeklyReportEmail, pickRecipient, type MemberCandidate } from "@/lib/recenzije/services/weekly-report-email";

/**
 * Tjedni izvještaj klijentu. NOVO vodi klijente kao uslugu (nemaju račun), pa izvještaj ide na
 * kontakt email spremljen na tvrtki (organizations.contactEmail); starije tvrtke bez njega
 * rezervno koriste email vlasnika. Interni operater (OPERATOR_EMAIL) nikad nije primatelj.
 * Dedupe bez izmjene sheme: nakon slanja ostaje događaj tipa
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
  /** Razumljivo objašnjenje razloga preskakanja (npr. što treba upisati u adminu). */
  detail?: string;
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

type Candidate = {
  organizationId: string;
  name: string;
  timezone: string;
  /** null = nema kamo poslati (ni kontakt email ni član s emailom). */
  recipient: MemberCandidate | null;
};

/**
 * Sve tvrtke osim demo (aktivni paket se provjerava u petlji), svaka s jednim primateljem: kontakt email tvrtke, inače (starije tvrtke)
 * vlasnik, inače admin, inače najstariji član. Operater se preskače. Tvrtke bez primatelja
 * ostaju na popisu s recipient = null da ih sažetak izvještaja jasno navede.
 */
async function reportCandidates(): Promise<Candidate[]> {
  const orgs = await db
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      timezone: organizations.timezone,
      contactEmail: organizations.contactEmail,
      contactName: organizations.contactName,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .where(eq(organizations.isDemo, false))
    .orderBy(asc(organizations.createdAt));

  const memberRows = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
      email: users.email,
      userName: users.name,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizations.isDemo, false), ne(users.email, OPERATOR_EMAIL)))
    .orderBy(asc(organizationMembers.createdAt));

  const membersByOrg = new Map<string, MemberCandidate[]>();
  for (const r of memberRows) {
    const list = membersByOrg.get(r.organizationId) ?? [];
    list.push({ role: r.role, email: r.email, name: r.userName, joinedAt: r.joinedAt });
    membersByOrg.set(r.organizationId, list);
  }

  return orgs.map((o) => {
    const contactEmail = o.contactEmail?.trim();
    const recipient: MemberCandidate | null = contactEmail
      ? { role: "OWNER", email: contactEmail, name: o.contactName?.trim() || null, joinedAt: o.createdAt }
      : pickRecipient(membersByOrg.get(o.organizationId) ?? []);
    return { organizationId: o.organizationId, name: o.name, timezone: o.timezone, recipient };
  });
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
        title: "Tjedni izvještaj poslan kontaktu klijenta",
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
  const push = (c: Candidate, status: WeeklyReportStatus, extra: { reason?: string; detail?: string; error?: string } = {}) =>
    results.push({ organizationId: c.organizationId, organization: c.name, status, ...extra });
  const noRecipient = (c: Candidate) =>
    push(c, "skipped", { reason: "no_recipient_email", detail: "Nema kontakt emaila. Upišite ga u /admin/recenzije (Kontakt i bilješka)." });

  // Probni rad (dryRun) ništa ne šalje ni bilježi pa ne treba ključ; pravi rad bez ključa preskače sve.
  const emailConfigured = integrations.email();
  if (!emailConfigured && !dryRun) {
    for (const c of candidates) {
      if (c.recipient) push(c, "skipped", { reason: "email_not_configured" });
      else noRecipient(c);
    }
    return summarize(dryRun, emailConfigured, results);
  }

  let lastSendAt = 0;
  for (const c of candidates) {
    const recipient = c.recipient;
    if (!recipient) {
      noRecipient(c);
      continue;
    }
    if (Date.now() > deadline) {
      push(c, "skipped", { reason: "time_budget" });
      continue;
    }
    if (!emailSchema.safeParse(recipient.email).success) {
      push(c, "skipped", { reason: "invalid_recipient_email", detail: `Kontakt email nije ispravan: ${recipient.email.slice(0, 80)}` });
      continue;
    }

    // Klijent kojem je paket ugašen ili istekao ne dobiva izvještaj (usluga se za njega više ne vodi).
    try {
      if (!(await usage(c.organizationId)).active) {
        push(c, "skipped", { reason: "subscription_inactive", detail: "Paket ili besplatno razdoblje nije aktivno u /admin/recenzije." });
        continue;
      }
    } catch (e) {
      push(c, "failed", { error: e instanceof Error ? e.message.slice(0, 200) : "Nepoznata greška" });
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
        recipientName: recipient.name,
        timezone: c.timezone,
        stats,
        contactEmail: env.salesEmail,
      });
      const wait = SEND_PACING_MS - (Date.now() - lastSendAt);
      if (wait > 0) await sleep(wait);
      const res = await sendEmail(recipient.email, mail.subject, mail.html, mail.text);
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
