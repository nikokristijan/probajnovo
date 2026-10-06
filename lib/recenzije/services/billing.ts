import "server-only";
import Stripe from "stripe";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { messages, organizations, plans, subscriptions, type Plan, type Subscription } from "@/lib/recenzije/db/schema";
import { env, integrations } from "@/lib/recenzije/env";

/**
 * Stripe billing. Plans (price, SMS limit, Stripe price id) are rows in the
 * `plans` table, never constants in code. Patterns follow nextjs/saas-starter:
 * Checkout for new subscriptions, the Customer Portal for changes, and the
 * webhook as the single source of truth for subscription state.
 */

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Stripe nije postavljen (STRIPE_SECRET_KEY i STRIPE_WEBHOOK_SECRET).");
  }
}

let stripeClient: Stripe | null = null;
function stripe() {
  if (!integrations.stripe()) throw new BillingNotConfiguredError();
  stripeClient ??= new Stripe(env.stripeSecret);
  return stripeClient;
}

export const TRIAL_DAYS = 14;
/** SMS allowance during the free trial (no plan row needed). */
export const TRIAL_SMS_LIMIT = 50;

export async function listPlans(): Promise<Plan[]> {
  return db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.position));
}

export async function getSubscription(organizationId: string): Promise<Subscription | null> {
  const [s] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).limit(1);
  return s ?? null;
}

export async function startTrial(organizationId: string) {
  await db
    .insert(subscriptions)
    .values({
      organizationId,
      planKey: "trial",
      status: "trialing",
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
    })
    .onConflictDoNothing();
}

/** Current plan + SMS usage this calendar month. */
export async function usage(organizationId: string) {
  const sub = await getSubscription(organizationId);
  const plan = sub && sub.planKey !== "trial" ? (await db.select().from(plans).where(eq(plans.key, sub.planKey)).limit(1))[0] : null;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ n }] = await db
    .select({ n: count() })
    .from(messages)
    .where(and(eq(messages.organizationId, organizationId), eq(messages.direction, "OUTBOUND"), gte(messages.createdAt, monthStart)));
  const limit = plan?.smsMonthlyLimit ?? TRIAL_SMS_LIMIT;
  const trialExpired = sub?.status === "trialing" && sub.trialEndsAt != null && sub.trialEndsAt < new Date();
  const active = sub ? ["active", "trialing"].includes(sub.status) && !trialExpired : false;
  return { subscription: sub, plan: plan ?? null, smsUsed: n, smsLimit: limit, active, trialExpired };
}

export async function createCheckoutSession(input: { organizationId: string; planKey: string; email: string }) {
  const [plan] = await db.select().from(plans).where(eq(plans.key, input.planKey)).limit(1);
  if (!plan) throw new Error("Nepoznat paket.");
  if (!plan.stripePriceId) {
    throw new Error(`Paket "${plan.name}" još nema Stripe cijenu. Postavite stripe_price_id u tablici nr_plans.`);
  }
  const sub = await getSubscription(input.organizationId);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    customer: sub?.stripeCustomerId ?? undefined,
    customer_email: sub?.stripeCustomerId ? undefined : input.email,
    client_reference_id: input.organizationId,
    metadata: { organizationId: input.organizationId, planKey: plan.key },
    subscription_data: { metadata: { organizationId: input.organizationId, planKey: plan.key } },
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/recenzije/postavke/pretplata?checkout=success`,
    cancel_url: `${env.appUrl}/recenzije/postavke/pretplata?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe nije vratio poveznicu za plaćanje.");
  return session.url;
}

export async function createPortalSession(organizationId: string) {
  const sub = await getSubscription(organizationId);
  if (!sub?.stripeCustomerId) throw new Error("Još nema Stripe kupca. Najprije odaberite paket.");
  const session = await stripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${env.appUrl}/recenzije/postavke/pretplata`,
  });
  return session.url;
}

export function constructWebhookEvent(payload: string, signature: string | null) {
  if (!env.stripeWebhookSecret) throw new BillingNotConfiguredError();
  if (!signature) throw new Error("Nedostaje Stripe potpis");
  return stripe().webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
}

/** Mirrors a Stripe subscription onto our row. Called from the webhook only. */
export async function handleSubscriptionChange(s: Stripe.Subscription) {
  const organizationId = s.metadata?.organizationId;
  const customerId = typeof s.customer === "string" ? s.customer : s.customer.id;
  const priceId = s.items.data[0]?.price.id;
  const [plan] = priceId ? await db.select().from(plans).where(eq(plans.stripePriceId, priceId)).limit(1) : [];

  let orgId = organizationId;
  if (!orgId) {
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId)).limit(1);
    orgId = row?.organizationId;
  }
  if (!orgId) return;
  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return;

  const periodEnd = s.items.data[0]?.current_period_end;
  const values = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: s.id,
    planKey: plan?.key ?? s.metadata?.planKey ?? "trial",
    status: s.status,
    cancelAtPeriodEnd: s.cancel_at_period_end,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };
  await db
    .insert(subscriptions)
    .values({ organizationId: orgId, ...values })
    .onConflictDoUpdate({ target: subscriptions.organizationId, set: values });
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !session.subscription) return;
  const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const sub = await stripe().subscriptions.retrieve(id);
  if (!sub.metadata?.organizationId && session.client_reference_id) {
    sub.metadata = { ...sub.metadata, organizationId: session.client_reference_id };
  }
  await handleSubscriptionChange(sub);
}

/**
 * Creates Stripe products/prices for plans that don't have one yet and stores
 * the price ids. Safe to run repeatedly (scripts/stripe-sync.ts).
 */
export async function syncPlansToStripe() {
  const rows = await listPlans();
  const out: { key: string; priceId: string }[] = [];
  for (const p of rows) {
    if (p.stripePriceId) {
      out.push({ key: p.key, priceId: p.stripePriceId });
      continue;
    }
    const product = await stripe().products.create({ name: `NOVO Recenzije ${p.name}`, metadata: { planKey: p.key } });
    const price = await stripe().prices.create({
      product: product.id,
      currency: p.currency,
      unit_amount: p.priceMonthlyCents,
      recurring: { interval: "month" },
      metadata: { planKey: p.key },
    });
    await db.update(plans).set({ stripePriceId: price.id }).where(eq(plans.id, p.id));
    out.push({ key: p.key, priceId: price.id });
  }
  return out;
}
