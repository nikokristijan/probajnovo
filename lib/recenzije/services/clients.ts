import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import {
  activityEvents,
  automationRuns,
  automations,
  campaigns,
  clients,
  messages,
  reviews,
  services,
  trackingLinks,
  type ReviewStatus,
} from "@/lib/recenzije/db/schema";
import { REVIEW_STATUS_ORDER } from "@/lib/recenzije/status";
import { clientHasNoticesConsentSql, hasNoticesConsent } from "./menu-consent";

export type ClientListParams = {
  q?: string;
  status?: string;
  service?: string;
  technician?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
};

const SORTS = ["name", "service_date", "status", "last_message", "created"] as const;
export type ClientSort = (typeof SORTS)[number];

export async function listClients(organizationId: string, p: ClientListParams) {
  const pageSize = Math.min(Math.max(p.pageSize ?? 10, 5), 100);
  const page = Math.max(1, p.page ?? 1);
  const sort: ClientSort = (SORTS as readonly string[]).includes(p.sort ?? "") ? (p.sort as ClientSort) : "created";
  const dir = p.dir === "asc" ? "asc" : "desc";

  // Latest service per client (lateral join keeps it to one row per client).
  const latest = sql`lateral (
    select s.name, s.technician, s.service_date, s.completed_at from ${services} s
    where s.client_id = "nr_clients"."id" and s.organization_id = ${organizationId}
    order by s.service_date desc limit 1
  ) ls`;

  const where: SQL[] = [eq(clients.organizationId, organizationId)];
  const q = p.q?.trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    where.push(
      or(
        ilike(sql`${clients.firstName} || ' ' || ${clients.lastName}`, like),
        ilike(clients.phone, like),
        ilike(clients.email, like)
      )!
    );
  }
  if (p.status && (REVIEW_STATUS_ORDER as string[]).includes(p.status)) {
    where.push(eq(clients.reviewStatus, p.status as ReviewStatus));
  }
  if (p.service) where.push(sql`ls.name = ${p.service}`);
  if (p.technician) where.push(sql`ls.technician = ${p.technician}`);

  const order = {
    name: [clients.firstName, clients.lastName],
    service_date: [sql`ls.service_date`],
    status: [sql`array_position(array['NOT_CONTACTED','REQUEST_SENT','CLICKED','FOLLOW_UP_SCHEDULED','REVIEW_RECEIVED','COMPLETED']::nr_review_status[], ${clients.reviewStatus})`],
    last_message: [clients.lastMessageAt],
    created: [clients.createdAt],
  }[sort].map((c) => (dir === "asc" ? sql`${asc(c as never)} nulls last` : sql`${desc(c as never)} nulls last`));

  const base = db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      phone: clients.phone,
      email: clients.email,
      reviewStatus: clients.reviewStatus,
      smsOptOut: clients.smsOptOut,
      /** 'menu' = gost koji je sam upisao broj na jelovniku (jedna poruka s molbom za recenziju). */
      source: clients.source,
      /** Gost s jelovnika koji je pristao i na obavijesti (nr_menu_guests.notices_consent). */
      noticesConsent: sql<boolean>`${clientHasNoticesConsentSql}`,
      lastMessageAt: clients.lastMessageAt,
      nextFollowUpAt: clients.nextFollowUpAt,
      createdAt: clients.createdAt,
      service: sql<string | null>`ls.name`,
      technician: sql<string | null>`ls.technician`,
      serviceDate: sql<Date | null>`ls.service_date`,
      total: sql<number>`count(*) over()::int`,
    })
    .from(clients)
    .leftJoin(latest, sql`true`)
    .where(and(...where));

  const rows = await base
    .orderBy(...order, desc(clients.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [svcNames, techs] = await Promise.all([
    db.selectDistinct({ v: services.name }).from(services).where(eq(services.organizationId, organizationId)).orderBy(services.name),
    db
      .selectDistinct({ v: services.technician })
      .from(services)
      .where(and(eq(services.organizationId, organizationId), sql`${services.technician} is not null`))
      .orderBy(services.technician),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, serviceDate: r.serviceDate ? new Date(r.serviceDate) : null })),
    total: rows[0]?.total ?? (page > 1 ? await countAll(organizationId) : 0),
    page,
    pageSize,
    sort,
    dir,
    serviceOptions: svcNames.map((s) => s.v),
    technicianOptions: techs.map((t) => t.v!).filter(Boolean),
  };
}

async function countAll(organizationId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(clients).where(eq(clients.organizationId, organizationId));
  return r.n;
}

export type ClientRow = Awaited<ReturnType<typeof listClients>>["rows"][number];

export async function getClientDetail(organizationId: string, clientId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);
  if (!client) return null;
  const [svc, msgs, links, revs, runs, activity] = await Promise.all([
    db.select().from(services).where(and(eq(services.clientId, clientId), eq(services.organizationId, organizationId))).orderBy(desc(services.serviceDate)),
    db.select().from(messages).where(and(eq(messages.clientId, clientId), eq(messages.organizationId, organizationId))).orderBy(desc(messages.createdAt)).limit(50),
    db.select().from(trackingLinks).where(and(eq(trackingLinks.clientId, clientId), eq(trackingLinks.organizationId, organizationId))).orderBy(desc(trackingLinks.createdAt)),
    db.select().from(reviews).where(and(eq(reviews.clientId, clientId), eq(reviews.organizationId, organizationId))).orderBy(desc(reviews.reviewedAt)),
    db
      .select({ run: automationRuns, automationName: automations.name, automationSteps: automations.steps, campaignName: campaigns.name })
      .from(automationRuns)
      .leftJoin(automations, eq(automations.id, automationRuns.automationId))
      .leftJoin(campaigns, eq(campaigns.id, automationRuns.campaignId))
      .where(and(eq(automationRuns.clientId, clientId), eq(automationRuns.organizationId, organizationId)))
      .orderBy(desc(automationRuns.startedAt))
      .limit(10),
    db.select().from(activityEvents).where(and(eq(activityEvents.clientId, clientId), eq(activityEvents.organizationId, organizationId))).orderBy(desc(activityEvents.createdAt)).limit(50),
  ]);
  const noticesConsent = client.source === "menu" ? await hasNoticesConsent(organizationId, clientId) : false;
  return { client, services: svc, messages: msgs, links, reviews: revs, runs, activity, noticesConsent };
}
