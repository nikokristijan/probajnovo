import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import {
  activityEvents,
  campaigns,
  clients,
  messages,
  reviews,
  services,
  trackingLinks,
} from "@/lib/recenzije/db/schema";
import { pct } from "@/lib/recenzije/utils";

/**
 * Every number here is computed from stored events — nothing is estimated.
 * "Reviews received" for a client means a review was attributed to them
 * (exact name match with Google data, or marked manually).
 */

const REQUEST_KINDS = ["REVIEW_REQUEST", "CAMPAIGN", "FOLLOW_UP"] as const;
const REVIEWED = ["REVIEW_RECEIVED", "COMPLETED"] as const;

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export async function dashboardStats(organizationId: string, days = 30) {
  const from = since(days);
  const prevFrom = since(days * 2);

  const [[clientsTotal], [clientsNew], statusRows, msgRows, [clicked], [reviewAgg], [prevReviewAgg]] = await Promise.all([
    db.select({ n: count() }).from(clients).where(eq(clients.organizationId, organizationId)),
    db.select({ n: count() }).from(clients).where(and(eq(clients.organizationId, organizationId), gte(clients.createdAt, from))),
    db
      .select({ status: clients.reviewStatus, n: count() })
      .from(clients)
      .where(eq(clients.organizationId, organizationId))
      .groupBy(clients.reviewStatus),
    db
      .select({ kind: messages.kind, status: messages.status, n: count() })
      .from(messages)
      .where(and(eq(messages.organizationId, organizationId), eq(messages.direction, "OUTBOUND"), gte(messages.createdAt, from)))
      .groupBy(messages.kind, messages.status),
    db
      .select({ n: count() })
      .from(trackingLinks)
      .where(and(eq(trackingLinks.organizationId, organizationId), gte(trackingLinks.firstClickedAt, from))),
    db
      .select({ n: count(), avg: sql<number | null>`avg(${reviews.rating})::float` })
      .from(reviews)
      .where(and(eq(reviews.organizationId, organizationId), gte(reviews.reviewedAt, from))),
    db
      .select({ n: count() })
      .from(reviews)
      .where(and(eq(reviews.organizationId, organizationId), gte(reviews.reviewedAt, prevFrom), lt(reviews.reviewedAt, from))),
  ]);

  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.n])) as Record<string, number>;
  const sent = msgRows
    .filter((r) => (REQUEST_KINDS as readonly string[]).includes(r.kind) && r.status !== "FAILED" && r.status !== "QUEUED")
    .reduce((a, r) => a + r.n, 0);
  const failed = msgRows.filter((r) => r.status === "FAILED" || r.status === "UNDELIVERED").reduce((a, r) => a + r.n, 0);
  const [allRating] = await db
    .select({ avg: sql<number | null>`avg(${reviews.rating})::float`, n: count() })
    .from(reviews)
    .where(eq(reviews.organizationId, organizationId));

  const reviewedClients = (byStatus.REVIEW_RECEIVED ?? 0) + (byStatus.COMPLETED ?? 0);
  const contactedClients = clientsTotal.n - (byStatus.NOT_CONTACTED ?? 0);

  return {
    days,
    clients: clientsTotal.n,
    clientsNew: clientsNew.n,
    requestsSent: sent,
    linksClicked: clicked.n,
    reviewsReceived: reviewAgg.n,
    reviewsPrev: prevReviewAgg.n,
    attributedClients: reviewedClients,
    conversionRate: pct(reviewedClients, contactedClients),
    clickRate: pct(clicked.n, sent),
    averageRating: allRating.avg,
    totalReviews: allRating.n,
    followUpsScheduled: byStatus.FOLLOW_UP_SCHEDULED ?? 0,
    failedMessages: failed,
    byStatus,
  };
}

export async function recentActivity(organizationId: string, limit = 12) {
  const rows = await db
    .select({ e: activityEvents, first: clients.firstName, last: clients.lastName })
    .from(activityEvents)
    .leftJoin(clients, eq(clients.id, activityEvents.clientId))
    .where(eq(activityEvents.organizationId, organizationId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.e, clientName: r.first ? `${r.first} ${r.last ?? ""}`.trim() : null }));
}

type Bucket = "day" | "week" | "month";

/** Fills gaps so charts don't skip empty periods. */
function fillSeries<T extends Record<string, number>>(rows: ({ bucket: string } & T)[], from: Date, bucket: Bucket, empty: T) {
  const map = new Map(rows.map((r) => [r.bucket, r]));
  const out: ({ bucket: string } & T)[] = [];
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  if (bucket === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (bucket === "month") d.setUTCDate(1);
  const now = new Date();
  while (d <= now) {
    const key = d.toISOString().slice(0, 10);
    out.push(map.get(key) ?? ({ bucket: key, ...empty } as { bucket: string } & T));
    if (bucket === "day") d.setUTCDate(d.getUTCDate() + 1);
    else if (bucket === "week") d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export async function reviewSeries(organizationId: string, days = 180, bucket: Bucket = "week") {
  const from = since(days);
  const trunc = sql.raw(`'${bucket}'`);
  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${trunc}, ${reviews.reviewedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
      reviews: sql<number>`count(*)::int`,
      rating: sql<number>`round(avg(${reviews.rating})::numeric, 2)::float`,
    })
    .from(reviews)
    .where(and(eq(reviews.organizationId, organizationId), gte(reviews.reviewedAt, from)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return fillSeries(rows, from, bucket, { reviews: 0, rating: 0 }).map((r) => ({
    ...r,
    rating: r.reviews > 0 ? r.rating : null,
  }));
}

export async function reviewStats(organizationId: string) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [[all], [month], dist, [matched], [replied]] = await Promise.all([
    db
      .select({ n: count(), avg: sql<number | null>`avg(${reviews.rating})::float` })
      .from(reviews)
      .where(eq(reviews.organizationId, organizationId)),
    db.select({ n: count() }).from(reviews).where(and(eq(reviews.organizationId, organizationId), gte(reviews.reviewedAt, monthStart))),
    db
      .select({ rating: reviews.rating, n: count() })
      .from(reviews)
      .where(eq(reviews.organizationId, organizationId))
      .groupBy(reviews.rating),
    db.select({ n: count() }).from(reviews).where(and(eq(reviews.organizationId, organizationId), isNotNull(reviews.clientId))),
    db.select({ n: count() }).from(reviews).where(and(eq(reviews.organizationId, organizationId), isNotNull(reviews.repliedAt))),
  ]);
  const distribution = [5, 4, 3, 2, 1].map((r) => ({ rating: r, n: dist.find((d) => d.rating === r)?.n ?? 0 }));
  return { total: all.n, average: all.avg, thisMonth: month.n, distribution, matched: matched.n, replied: replied.n };
}

export async function messageSeries(organizationId: string, days = 30) {
  const from = since(days);
  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('day', ${messages.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
      sent: sql<number>`count(*) filter (where ${messages.status} in ('SENT','DELIVERED'))::int`,
      failed: sql<number>`count(*) filter (where ${messages.status} in ('FAILED','UNDELIVERED'))::int`,
    })
    .from(messages)
    .where(and(eq(messages.organizationId, organizationId), eq(messages.direction, "OUTBOUND"), gte(messages.createdAt, from)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const clicks = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('day', ${trackingLinks.firstClickedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
      clicks: sql<number>`count(*)::int`,
    })
    .from(trackingLinks)
    .where(and(eq(trackingLinks.organizationId, organizationId), gte(trackingLinks.firstClickedAt, from)))
    .groupBy(sql`1`);
  const clickMap = new Map(clicks.map((c) => [c.bucket, c.clicks]));
  return fillSeries(rows, from, "day", { sent: 0, failed: 0 }).map((r) => ({ ...r, clicks: clickMap.get(r.bucket) ?? 0 }));
}

/** Clients contacted → clicked → reviewed, over all time. */
export async function funnel(organizationId: string) {
  const rows = await db
    .select({ status: clients.reviewStatus, n: count() })
    .from(clients)
    .where(eq(clients.organizationId, organizationId))
    .groupBy(clients.reviewStatus);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  const total = rows.reduce((a, r) => a + r.n, 0);
  const reviewed = (by.REVIEW_RECEIVED ?? 0) + (by.COMPLETED ?? 0);
  const contacted = total - (by.NOT_CONTACTED ?? 0);
  // A client who reviewed must have clicked or reviewed directly; we count "clicked" as having any click.
  const [clickedRow] = await db
    .select({ n: sql<number>`count(distinct ${trackingLinks.clientId})::int` })
    .from(trackingLinks)
    .where(and(eq(trackingLinks.organizationId, organizationId), isNotNull(trackingLinks.firstClickedAt)));
  return [
    { stage: "Klijenti", value: total },
    { stage: "Poslan zahtjev", value: contacted },
    { stage: "Kliknuli link", value: clickedRow.n },
    { stage: "Ostavili recenziju", value: reviewed },
  ];
}

/** Per-dimension performance: requests sent, clicked, reviewed. */
async function clientOutcomesBy(organizationId: string, dimension: "technician" | "service") {
  // Latest service per client decides the dimension.
  const rows = await db.execute<{ key: string | null; clients: number; contacted: number; clicked: number; reviewed: number }>(sql`
    with latest as (
      select distinct on (s.client_id) s.client_id, ${sql.raw(dimension === "technician" ? "s.technician" : "s.name")} as key
      from ${services} s
      where s.organization_id = ${organizationId}
      order by s.client_id, s.service_date desc
    )
    select coalesce(l.key, 'Nije dodijeljeno') as key,
      count(*)::int as clients,
      count(*) filter (where c.review_status <> 'NOT_CONTACTED')::int as contacted,
      count(*) filter (where c.review_status in ('CLICKED','REVIEW_RECEIVED','COMPLETED')
        or exists (select 1 from ${trackingLinks} t where t.client_id = c.id and t.first_clicked_at is not null))::int as clicked,
      count(*) filter (where c.review_status in ('REVIEW_RECEIVED','COMPLETED'))::int as reviewed
    from latest l join ${clients} c on c.id = l.client_id
    where c.organization_id = ${organizationId}
    group by 1 order by reviewed desc, clients desc
  `);
  return Array.from(rows).map((r) => ({ ...r, key: r.key ?? "Nije dodijeljeno", conversion: pct(r.reviewed, r.contacted) }));
}

export const byTechnician = (orgId: string) => clientOutcomesBy(orgId, "technician");
export const byService = (orgId: string) => clientOutcomesBy(orgId, "service");

export async function byCampaign(organizationId: string) {
