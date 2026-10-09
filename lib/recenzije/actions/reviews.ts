"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { clients, reviews } from "@/lib/recenzije/db/schema";
import type { ActionState } from "@/lib/recenzije/action";
import { integrations } from "@/lib/recenzije/env";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { REVIEW_SUMMARY_MAX_REVIEWS, type ReviewSummaryPayload } from "@/lib/recenzije/review-summary";
import { requireOrg, requireWritableOrg } from "@/lib/recenzije/session";
import { AiNotConfiguredError, suggestReply, summarizeReviews } from "@/lib/recenzije/services/ai";
import { markReviewReceived, replyToReview, syncReviews } from "@/lib/recenzije/services/google";

function errorState(e: unknown): ActionState {
  if (e instanceof AiNotConfiguredError) return { error: e.message, data: { code: "AI_NOT_CONFIGURED" } };
  return { error: e instanceof Error ? e.message : "Nešto je pošlo po zlu" };
}

export async function syncReviewsAction(): Promise<ActionState> {
  const ctx = await requireOrg();
  if (ctx.org.isDemo) return { error: "Demo nije povezan s pravim Google profilom." };
  const rl = rateLimit(`sync:${ctx.org.id}`, 6, 60_000);
  if (!rl.ok) return { error: "Preuzimanje je upravo pokrenuto. Pokušajte za minutu." };
  try {
    const r = await syncReviews(ctx.org.id);
    revalidatePath("/recenzije/ocjene");
    revalidatePath("/recenzije/pregled");
    const src = r.source === "places" ? "Places API (samo 5 najnovijih)" : "Google Business Profile";
    return {
      ok: true,
      message: `Preuzeto ${r.fetched} recenzija (${src}): ${r.added} novih, ${r.matched} povezano s klijentima.`,
    };
  } catch (e) {
    return errorState(e);
  }
}

export async function linkReviewAction(reviewId: string, clientId: string): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const ids = z.object({ reviewId: z.string().min(1).max(40), clientId: z.string().max(40) }).safeParse({ reviewId, clientId });
  if (!ids.success) return { error: "Neispravan unos" };
  const [review] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.organizationId, ctx.org.id)))
    .limit(1);
  if (!review) return { error: "Recenzija nije pronađena" };
  if (!clientId) {
    await db.update(reviews).set({ clientId: null, match: "NONE" }).where(eq(reviews.id, review.id));
    revalidatePath("/recenzije/ocjene");
    return { ok: true, message: "Recenzija odvojena od klijenta" };
  }
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.org.id)))
    .limit(1);
  if (!client) return { error: "Klijent nije pronađen" };
  await markReviewReceived(ctx.org.id, client.id, review.id, "MANUAL", review.reviewedAt, review.rating);
  revalidatePath("/recenzije/ocjene");
  revalidatePath(`/recenzije/klijenti/${client.id}`);
  return { ok: true, message: "Recenzija povezana s klijentom" };
}

export async function suggestReplyAction(reviewId: string): Promise<ActionState> {
  const ctx = await requireOrg();
  const rl = rateLimit(`ai:${ctx.org.id}`, 20, 60_000);
  if (!rl.ok) return { error: "Previše AI zahtjeva. Pričekajte minutu." };
  const [review] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.organizationId, ctx.org.id)))
    .limit(1);
  if (!review) return { error: "Recenzija nije pronađena" };
  try {
    const text = await suggestReply(review, ctx.org.name);
    return { ok: true, data: { text } };
  } catch (e) {
    return errorState(e);
  }
}

export async function postReplyAction(reviewId: string, text: string): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const body = z.string().trim().min(2, "Najprije napišite odgovor").max(4000).safeParse(text);
  if (!body.success) return { error: body.error.issues[0].message };
  const [review] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.organizationId, ctx.org.id)))
    .limit(1);
  if (!review) return { error: "Recenzija nije pronađena" };
  if (review.source !== "GOOGLE" || !review.externalId) {
    return { error: "Odavde se može odgovoriti samo na recenzije preuzete iz Google Business Profilea." };
  }
  try {
    await replyToReview(ctx.org.id, review.externalId, body.data);
    revalidatePath("/recenzije/ocjene");
    return { ok: true, message: "Odgovor objavljen na Googleu" };
  } catch (e) {
    return errorState(e);
  }
}

/**
 * AI sažetak zadnjih recenzija organizacije. Šalju se samo ocjena, datum i tekst
 * (bez imena recenzenata). Bez ključa, bez recenzija ili uz grešku AI-ja vraća
 * jasnu poruku; nikad ne vraća izmišljen sažetak.
 */
export async function summarizeReviewsAction(): Promise<ActionState> {
  const ctx = await requireOrg();
  if (!integrations.ai()) return errorState(new AiNotConfiguredError());

  const rows = await db
    .select({ rating: reviews.rating, comment: reviews.comment, reviewedAt: reviews.reviewedAt })
    .from(reviews)
    .where(eq(reviews.organizationId, ctx.org.id))
    .orderBy(desc(reviews.reviewedAt))
    .limit(REVIEW_SUMMARY_MAX_REVIEWS);
  if (rows.length === 0) return { error: "Još nema recenzija", data: { code: "NO_REVIEWS" } };
  const withTextCount = rows.filter((r) => (r.comment ?? "").trim().length > 0).length;
  if (withTextCount === 0) {
    return {
      error: "Nijedna od zadnjih recenzija nema napisan tekst, pa nema što sažeti. Postoje samo ocjene.",
      data: { code: "NO_TEXT" },
    };
  }

  // Sažetak je skuplji od običnog AI poziva, pa ima vlastiti, stroži limit (demo još stroži).
  const rl = rateLimit(`ai-summary:${ctx.org.id}`, ctx.org.isDemo ? 3 : 6, 10 * 60_000);
  if (!rl.ok) {
    return { error: `Sažetak ste upravo tražili. Pokušajte ponovno za ${Math.max(1, Math.ceil(rl.retryAfter / 60))} min.` };
  }

  try {
    const summary = await summarizeReviews(rows);
    const payload: ReviewSummaryPayload = {
      ...summary,
      reviewCount: rows.length,
      withTextCount,
      averageRating: rows.reduce((a, r) => a + r.rating, 0) / rows.length,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true, data: payload };
  } catch (e) {
    return errorState(e);
  }
}
