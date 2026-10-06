import type Stripe from "stripe";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { constructWebhookEvent, handleCheckoutCompleted, handleSubscriptionChange } from "@/lib/recenzije/services/billing";

/** Stripe is the source of truth for subscription state; this mirrors it into our DB. */
export async function POST(req: Request) {
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, req.headers.get("stripe-signature"));
  } catch (e) {
    return new Response(`Webhook error: ${e instanceof Error ? e.message : "invalid"}`, { status: 400 });
  }
  await ensureReviewsDb();
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChange(event.data.object);
      break;
  }
  return Response.json({ received: true });
}
