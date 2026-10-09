import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { organizations, plans, subscriptions, type Subscription } from "@/lib/recenzije/db/schema";
import { OPERATOR_EMAIL } from "@/lib/recenzije/operator";
import { isFreePeriod, TRIAL_SMS_LIMIT } from "@/lib/recenzije/services/billing";

/**
 * Pregled NOVO Recenzija za NOVO admin (/admin/recenzije). NOVO Recenzije su usluga koju
 * vodi NOVO tim: klijenti nemaju prijavu, a tim ovdje vodi svakog klijenta (paket,
 * besplatno razdoblje, plaćeni mjeseci, gašenje). Pristup provjerava pozivatelj
 * (samo glavni admin).
 */

/** Greška čiju poruku smijemo pokazati adminu; sve ostalo (npr. greške baze s upitom i parametrima) ne. */
export class AdminError extends Error {}

export type AdminOrgState = "active" | "free_period" | "free_expired" | "expired" | "inactive";
export type AdminOrgRow = Awaited<ReturnType<typeof listOrganizationsForNovoAdmin>>[number];

const DAY_MS = 86_400_000;

/** Datum za poruke i prikaz: fiksna vremenska zona da ne ovisi o poslužitelju. */
export function formatAdminDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("hr-HR", { timeZone: "Europe/Zagreb" });
}

export async function listOrganizationsForNovoAdmin() {
  await ensureReviewsDb();
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      industry: organizations.industry,
      phone: organizations.phone,
      contactName: organizations.contactName,
      contactEmail: organizations.contactEmail,
      contactPhone: organizations.contactPhone,
      internalNote: organizations.internalNote,
      createdAt: organizations.createdAt,
      hasReviewUrl: sql<boolean>`coalesce(length(trim(${organizations.googleReviewUrl})), 0) > 0`,
      // Stariji računi koje je tvrtka sama otvorila: vlasnik ostaje rezervni kontakt. Operater nikad.
      ownerEmail: sql<string | null>`(select u.email from nr_organization_members m join nr_users u on u.id = m.user_id where m.organization_id = "nr_organizations"."id" and u.email <> ${OPERATOR_EMAIL} order by (m.role = 'OWNER') desc, m.created_at asc limit 1)`,
      ownerName: sql<string | null>`(select u.name from nr_organization_members m join nr_users u on u.id = m.user_id where m.organization_id = "nr_organizations"."id" and u.email <> ${OPERATOR_EMAIL} order by (m.role = 'OWNER') desc, m.created_at asc limit 1)`,
      clients: sql<number>`(select count(*)::int from nr_clients c where c.organization_id = "nr_organizations"."id")`,
      smsThisMonth: sql<number>`(select count(*)::int from nr_messages x where x.organization_id = "nr_organizations"."id" and x.direction = 'OUTBOUND' and x.status <> 'FAILED' and x.kind <> 'TEST' and x.created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')`,
      // Procjena segmenata poruka poslanih preko Twilija ovaj mjesec (osnova za procjenu troška; uključuje i probne poruke tvrtke, jer se naplaćuju). ASCII tekst je GSM-7
      // (160 / 153 znaka po segmentu), sve ostalo Unicode (70 / 67); ne računa proširene GSM znakove, pa je to procjena.
      twilioSegmentsThisMonth: sql<number>`(select coalesce(sum(case when x.body ~ '^[ -~[:space:]]*$' then (case when char_length(x.body) <= 160 then 1 else ceil(char_length(x.body) / 153.0)::int end) else (case when char_length(x.body) <= 70 then 1 else ceil(char_length(x.body) / 67.0)::int end) end), 0)::int from nr_messages x where x.organization_id = "nr_organizations"."id" and x.direction = 'OUTBOUND' and x.status <> 'FAILED' and x.from_number like 'twilio:%' and x.created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')`,
      sms30d: sql<number>`(select count(*)::int from nr_messages x where x.organization_id = "nr_organizations"."id" and x.direction = 'OUTBOUND' and x.created_at >= now() - interval '30 days')`,
      failed30d: sql<number>`(select count(*)::int from nr_messages x where x.organization_id = "nr_organizations"."id" and x.direction = 'OUTBOUND' and x.status in ('FAILED','UNDELIVERED') and x.created_at >= now() - interval '30 days')`,
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
    const stripe = !!s?.stripeSubscriptionId;
    // Stari "trialing" redovi (prije preokreta na uslugu) vode se kao besplatno razdoblje.
    const trialing = s?.status === "trialing";
    const trialExpired = trialing && !!s?.trialEndsAt && s.trialEndsAt < now;
    const periodExpired = s?.status === "active" && !stripe && !!s.currentPeriodEnd && s.currentPeriodEnd < now;
    const active = !!s && ["active", "trialing"].includes(s.status) && !trialExpired && !periodExpired;
    const hadFreePeriod = !!s?.freePeriodEndsAt;

    let state: AdminOrgState = "inactive";
    if (trialing) state = trialExpired ? "free_expired" : "free_period";
    else if (s?.status === "active") {
      if (periodExpired) state = hadFreePeriod ? "free_expired" : "expired";
      else state = isFreePeriod(s, now) ? "free_period" : "active";
    }

    const paying = state === "active" && s?.planKey !== "trial";
    return {
      ...r,
      smsLimit: s && s.planKey !== "trial" ? (r.planSmsLimit ?? TRIAL_SMS_LIMIT) : TRIAL_SMS_LIMIT,
      state,
      active,
      paying,
      viaStripe: stripe,
      endsAt: trialing ? (s?.trialEndsAt ?? null) : (s?.currentPeriodEnd ?? null),
    };
  });
}

export function summarize(rows: AdminOrgRow[]) {
  const paying = rows.filter((r) => r.paying);
  return {
    total: rows.length,
    paying: paying.length,
    freePeriod: rows.filter((r) => r.state === "free_period").length,
    lapsed: rows.filter((r) => r.state === "free_expired" || r.state === "expired" || r.state === "inactive").length,
    mrrCents: paying.reduce((a, r) => a + (r.planPriceCents ?? 0), 0),
    sms30d: rows.reduce((a, r) => a + r.sms30d, 0),
  };
}

export async function listPlansForNovoAdmin() {
  await ensureReviewsDb();
  return db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.position));
}

// --- Vrijednosti pretplate (dijeli ih i stvaranje novog klijenta) ---

type SubscriptionValues = Pick<
  Subscription,
  "planKey" | "status" | "currentPeriodEnd" | "trialEndsAt" | "freePeriodEndsAt" | "cancelAtPeriodEnd"
>;

function periodValues(planKey: string, end: Date, free: boolean): SubscriptionValues {
  return {
    planKey,
    status: "active",
    currentPeriodEnd: end,
    trialEndsAt: null,
    freePeriodEndsAt: free ? end : null,
    cancelAtPeriodEnd: false,
  };
}

/** Besplatno razdoblje: aktivna pretplata na paketu do `end`, ograničena SMS limitom paketa. */
export function freePeriodValues(planKey: string, end: Date): SubscriptionValues {
  return periodValues(planKey, end, true);
}

/** Plaćeni paket na N mjeseci od danas. */
export function paidPeriodValues(planKey: string, months: number): SubscriptionValues {
  const n = Math.min(24, Math.max(1, Math.round(months)));
  const end = new Date();
  end.setMonth(end.getMonth() + n);
  return periodValues(planKey, end, false);
}

export function clampFreeDays(days: number) {
  return Math.min(90, Math.max(1, Math.round(days)));
}

// --- Izmjene (svaka radnja je po klijentu) ---

async function orgName(organizationId: string) {
  const [o] = await db
    .select({ name: organizations.name, isDemo: organizations.isDemo })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!o) throw new AdminError("Klijent nije pronađen.");
  if (o.isDemo) throw new AdminError("Demo se ne mijenja.");
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

async function requireManual(organizationId: string) {
  const name = await orgName(organizationId);
  if (await stripeManaged(organizationId)) {
    throw new AdminError("Ovaj klijent plaća preko Stripea. Paket se mijenja u Stripeu.");
  }
  return name;
}

async function activePlan(planKey: string) {
  const [plan] = await db.select().from(plans).where(eq(plans.key, planKey)).limit(1);
  if (!plan) throw new AdminError("Nepoznat paket.");
  return plan;
}

async function saveSubscription(organizationId: string, values: SubscriptionValues) {
  // Ručni paket nikad ne smije nasljediti staru (otkazanu) Stripe vezu: requireManual je već
  // provjerio da je nema ili je otkazana. Inače bi redak ostao "Stripe", pa bi rok trajanja
  // prestao vrijediti, besplatno razdoblje se ne bi prepoznalo, a admin ga ne bi mogao ugasiti.
  await db
    .insert(subscriptions)
    .values({ organizationId, ...values })
    .onConflictDoUpdate({
      target: subscriptions.organizationId,
      set: { ...values, stripeSubscriptionId: null, updatedAt: new Date() },
    });
}

/** Aktivacija plaćenog paketa na N mjeseci od danas (plaćanje virmanom / dogovor). Briše besplatno razdoblje. */
export async function activatePlanManually(organizationId: string, planKey: string, months: number) {
  await ensureReviewsDb();
  const name = await requireManual(organizationId);
  const plan = await activePlan(planKey);
  const values = paidPeriodValues(plan.key, months);
  await saveSubscription(organizationId, values);
  return `${name}: plaćeni paket ${plan.name} do ${formatAdminDate(values.currentPeriodEnd)}`;
}

/**
 * Besplatno razdoblje od `days` dana na odabranom paketu. Ako već traje (besplatno ili
 * plaćeno), dani se dodaju na njegov kraj; inače računaju od danas. Slanje radi normalno
 * i ograničeno je SMS limitom paketa. Na plaćeni paket dani se dodaju kao dar (ostaje plaćeni).
 */
export async function extendFreePeriod(organizationId: string, planKey: string, days: number) {
  await ensureReviewsDb();
  const name = await requireManual(organizationId);
  const plan = await activePlan(planKey);
  const n = clampFreeDays(days);
  const [s] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).limit(1);
  const now = new Date();

  const paidRunning =
    s?.status === "active" && !s.stripeSubscriptionId && !s.freePeriodEndsAt && !!s.currentPeriodEnd && s.currentPeriodEnd > now;
  const freeRunning = isFreePeriod(s, now) && !!s?.currentPeriodEnd && s.currentPeriodEnd > now;
  const legacyTrialRunning = s?.status === "trialing" && !!s.trialEndsAt && s.trialEndsAt > now;

  const base = paidRunning || freeRunning ? s!.currentPeriodEnd! : legacyTrialRunning ? s!.trialEndsAt! : now;
  const end = new Date(base.getTime() + n * DAY_MS);
  const values = periodValues(plan.key, end, !paidRunning);
  await saveSubscription(organizationId, values);
  return paidRunning
    ? `${name}: dodano ${n} dana, paket ${plan.name} vrijedi do ${formatAdminDate(end)}`
    : `${name}: besplatno razdoblje (${plan.name}) do ${formatAdminDate(end)}`;
}

/** Promjena paketa uz zadržan rok (npr. prelazak s Startera na Growth usred razdoblja). */
export async function changePlan(organizationId: string, planKey: string) {
  await ensureReviewsDb();
  const name = await requireManual(organizationId);
  const plan = await activePlan(planKey);
  const [s] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).limit(1);
  if (!s || s.status !== "active") {
    throw new AdminError("Najprije dodajte besplatno razdoblje ili aktivirajte plaćeni paket.");
  }
  await db.update(subscriptions).set({ planKey: plan.key, updatedAt: new Date() }).where(eq(subscriptions.organizationId, organizationId));
  return `${name}: paket promijenjen na ${plan.name}`;
}

/** Gasi ručnu pretplatu ili besplatno razdoblje: slanje SMS-a staje odmah, podaci ostaju. */
export async function deactivate(organizationId: string) {
  await ensureReviewsDb();
  const name = await requireManual(organizationId);
  await db
    .update(subscriptions)
    .set({ status: "canceled", currentPeriodEnd: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, organizationId));
  return `${name}: pretplata ugašena`;
}
