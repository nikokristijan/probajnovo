import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { organizations, plans, subscriptions } from "@/lib/recenzije/db/schema";
import { TRIAL_DAYS, TRIAL_SMS_LIMIT } from "@/lib/recenzije/services/billing";

/**
 * Pregled NOVO Recenzija za NOVO admin (/admin/recenzije): sve tvrtke koje
 * koriste aplikaciju, njihov paket i potrošnja, te ručno upravljanje
 * pretplatom (aktivacija paketa, produženje probe, gašenje) za tvrtke koje
 * ne plaćaju preko Stripea. Pristup provjerava pozivatelj (samo glavni admin).
 */

export type AdminOrgRow = Awaited<ReturnType<typeof listOrganizationsForNovoAdmin>>[number];

export async function listOrganizationsForNovoAdmin() {
  await ensureReviewsDb();
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      industry: organizations.industry,
      createdAt: organizations.createdAt,
      hasReviewUrl: sql<boolean>`${organizations.googleReviewUrl} is not null`,
      hasGateway: sql<boolean>`${organizations.smsGatewayUser} is not null and ${organizations.smsGatewayPassEnc} is not null`,
      googleConnected: sql<boolean>`exists(select 1 from nr_google_connections g where g.organization_id = "nr_organizations"."id" and g.status = 'CONNECTED')`,
      ownerEmail: sql<string | null>`(select u.email from nr_organization_members m join nr_users u on u.id = m.user_id where m.organization_id = "nr_organizations"."id" order by (m.role = 'OWNER') desc, m.created_at asc limit 1)`,
      ownerName: sql<string | null>`(select u.name from nr_organization_members m join nr_users u on u.id = m.user_id where m.organization_id = "nr_organizations"."id" order by (m.role = 'OWNER') desc, m.created_at asc limit 1)`,
      members: sql<number>`(select count(*)::int from nr_organization_members m where m.organization_id = "nr_organizations"."id")`,
      clients: sql<number>`(select count(*)::int from nr_clients c where c.organization_id = "nr_organizations"."id")`,
      smsThisMonth: sql<number>`(select count(*)::int from nr_messages x where x.organization_id = "nr_organizations"."id" and x.direction = 'OUTBOUND' and x.created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')`,
      sms30d: sql<number>`(select count(*)::int from nr_messages x where x.organization_id = "nr_organizations"."id" and x.direction = 'OUTBOUND' and x.created_at >= now() - interval '30 days')`,
      failed30d: sql<number>`(select count(*)::int from nr_messages x where x.organization_id = "nr_organizations"."id" and x.direction = 'OUTBOUND' and x.status in ('FAILED','UNDELIVERED') and x.created_at >= now() - interval '30 days')`,
      clicks30d: sql<number>`(select count(*)::int from nr_link_clicks k join nr_tracking_links t on t.id = k.link_id where t.organization_id = "nr_organizations"."id" and k.created_at >= now() - interval '30 days')`,
      reviews: sql<number>`(select count(*)::int from nr_reviews r where r.organization_id = "nr_organizations"."id")`,
      lastMessageAt: sql<Date | null>`(select max(x.created_at) from nr_messages x where x.organization_id = "nr_organizations"."id")`,
      sub: subscriptions,
      planName: plans.name,
      planPriceCents: plans.priceMonthlyCents,
      planSmsLimit: plans.smsMonthlyLimit,
    })
    .from(organizations)
    .leftJoin(subscriptions, eq(subscriptions.organizationId, organizations.id))
    .leftJoin(plans, eq(plans.key, subscriptions.planKey))
    .where(eq(organizations.isDemo, false))
    .orderBy(desc(organizations.createdAt));

  const now = new Date();
  return rows.map((r) => {
    const s = r.sub;
    const trialing = s?.status === "trialing";
    const trialExpired = trialing && !!s?.trialEndsAt && s.trialEndsAt < now;
    const manual = !!s && !s.stripeSubscriptionId;
    const periodExpired = s?.status === "active" && manual && !!s.currentPeriodEnd && s.currentPeriodEnd < now;
    const active = !!s && ["active", "trialing"].includes(s.status) && !trialExpired && !periodExpired;
    const state: "trial" | "trial_expired" | "active" | "expired" | "inactive" = trialing
      ? trialExpired
        ? "trial_expired"
        : "trial"
      : s?.status === "active"
        ? periodExpired
          ? "expired"
          : "active"
        : "inactive";
    const paying = state === "active" && s?.planKey !== "trial";
    return {
      ...r,
      smsLimit: s && s.planKey !== "trial" ? (r.planSmsLimit ?? TRIAL_SMS_LIMIT) : TRIAL_SMS_LIMIT,
      state,
      active,
      paying,
      viaStripe: !!s?.stripeSubscriptionId,
      endsAt: trialing ? (s?.trialEndsAt ?? null) : (s?.currentPeriodEnd ?? null),
    };
  });
}

export function summarize(rows: AdminOrgRow[]) {
  const paying = rows.filter((r) => r.paying);
  return {
    total: rows.length,
    paying: paying.length,
    trial: rows.filter((r) => r.state === "trial").length,
    lapsed: rows.filter((r) => r.state === "trial_expired" || r.state === "expired" || r.state === "inactive").length,
    mrrCents: paying.reduce((a, r) => a + (r.planPriceCents ?? 0), 0),
    sms30d: rows.reduce((a, r) => a + r.sms30d, 0),
  };
}

export async function listPlansForNovoAdmin() {
  await ensureReviewsDb();
  return db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.position));
}

async function orgName(organizationId: string) {
  const [o] = await db
    .select({ name: organizations.name, isDemo: organizations.isDemo })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!o) throw new Error("Tvrtka nije pronađena.");
  if (o.isDemo) throw new Error("Demo tvrtka se ne mijenja.");
  return o.name;
}

async function stripeManaged(organizationId: string) {
  const [s] = await db
    .select({ id: subscriptions.stripeSubscriptionId, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);
  return !!s?.id && s.status !== "canceled";
}

/** Ručna aktivacija paketa na N mjeseci (plaćanje virmanom / dogovor). */
export async function activatePlanManually(organizationId: string, planKey: string, months: number) {
  await ensureReviewsDb();
  const name = await orgName(organizationId);
  if (await stripeManaged(organizationId)) {
    throw new Error("Ova tvrtka plaća preko Stripea. Paket mijenjaj u Stripeu.");
  }
  const [plan] = await db.select().from(plans).where(eq(plans.key, planKey)).limit(1);
  if (!plan) throw new Error("Nepoznat paket.");
  const n = Math.min(24, Math.max(1, Math.round(months)));
  const end = new Date();
  end.setMonth(end.getMonth() + n);
  const values = { planKey: plan.key, status: "active", currentPeriodEnd: end, cancelAtPeriodEnd: false };
  await db
    .insert(subscriptions)
    .values({ organizationId, ...values })
    .onConflictDoUpdate({ target: subscriptions.organizationId, set: { ...values, updatedAt: new Date() } });
  return `${name}: paket ${plan.name} do ${end.toLocaleDateString("hr-HR")}`;
}

/** Produži (ili ponovno otvori) besplatnu probu za `days` dana od danas ili od kraja trenutne probe. */
export async function extendTrial(organizationId: string, days = TRIAL_DAYS) {
  await ensureReviewsDb();
  const name = await orgName(organizationId);
  if (await stripeManaged(organizationId)) {
    throw new Error("Ova tvrtka plaća preko Stripea.");
  }
  const [s] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).limit(1);
  const base = s?.status === "trialing" && s.trialEndsAt && s.trialEndsAt > new Date() ? s.trialEndsAt : new Date();
  const end = new Date(base.getTime() + Math.min(90, Math.max(1, days)) * 86_400_000);
  const values = { planKey: "trial", status: "trialing", trialEndsAt: end, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  await db
    .insert(subscriptions)
    .values({ organizationId, ...values })
    .onConflictDoUpdate({ target: subscriptions.organizationId, set: { ...values, updatedAt: new Date() } });
  return `${name}: proba do ${end.toLocaleDateString("hr-HR")}`;
}

/** Gasi ručnu pretplatu ili probu: slanje SMS-a staje odmah, podaci ostaju. */
export async function deactivate(organizationId: string) {
  await ensureReviewsDb();
  const name = await orgName(organizationId);
  if (await stripeManaged(organizationId)) {
    throw new Error("Ova tvrtka plaća preko Stripea. Otkaži u Stripeu.");
  }
  await db
    .update(subscriptions)
    .set({ status: "canceled", currentPeriodEnd: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, organizationId));
  return `${name}: pretplata ugašena`;
}
