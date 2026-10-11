import "server-only";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { organizations, reviews } from "@/lib/recenzije/db/schema";
import { env, integrations } from "@/lib/recenzije/env";
import { AiNotConfiguredError, suggestReply } from "@/lib/recenzije/services/ai";
import { sendEmail } from "@/lib/recenzije/services/email";
import {
  LOW_REVIEW_MAX_RATING,
  LOW_REVIEW_WINDOW_DAYS,
  alertEligibility,
  buildLowReviewEmail,
} from "@/lib/recenzije/services/low-review-email";

/**
 * Upozorenje vlasniku na lošu Google recenziju (ocjena 3 ili manje).
 *
 * Pravila (sva na jednom mjestu, da ih je lako provjeriti):
 * - Šalje se najviše JEDAN e-mail po recenziji, na kontakt e-mail tvrtke (organizations.contact_email), i to samo ako je
 *   uključen prekidač low_review_alerts, tvrtka nije demo, a recenziju je Google objavio u zadnjih 14 dana.
 * - "Nova" znači: redak recenzije je upravo nastao u ovoj sinkronizaciji. Pri spremanju (google.ts) se `low_alert_at` postavlja
 *   odmah za sve što NIJE podobno (dobra ocjena, stara, isključeno, nema e-maila, demo), a ostaje null samo za podobne.
 *   Kasnija izmjena ocjene postojeće recenzije ili ponovna sinkronizacija zato nikad ne pokreću upozorenje.
 * - Dedupe: prije slanja se redak atomarno "zauzme" (UPDATE ... WHERE low_alert_at IS NULL), pa dvije istodobne sinkronizacije
 *   ne mogu obje poslati. Ako slanje ne uspije, redak se oslobađa i pokušaj se ponavlja pri idućoj sinkronizaciji,
 *   ali samo dok je recenzija mlađa od 14 dana.
 * - Prijedlog odgovora piše AI ako je postavljen (ANTHROPIC_API_KEY), inače se šalje kratak pristojan zadani tekst.
 *   Ništa se ne objavljuje na Googleu samo od sebe.
 */

/** Najviše upozorenja po jednoj sinkronizaciji (AI + e-mail traju); ostatak čeka iduću sinkronizaciju. */
const MAX_PER_RUN = 5;
/** Resend besplatni plan: 2 zahtjeva u sekundi. */
const SEND_PACING_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type AlertRunResult = { sent: number; failed: number; skipped: number };

/** Gdje vlasnik odgovara na recenziju: popis recenzija mjesta ako je poznat Place ID, inače Google Business nadzorna ploča. */
export function googleReplyUrl(placeId: string | null | undefined): string {
  const id = (placeId ?? "").trim();
  return id ? `https://search.google.com/local/reviews?placeid=${encodeURIComponent(id)}` : "https://business.google.com/reviews";
}

async function releaseClaim(reviewId: string) {
  try {
    await db.update(reviews).set({ lowAlertAt: null }).where(eq(reviews.id, reviewId));
  } catch (e) {
    console.error("[review-alerts] oslobađanje oznake nije uspjelo", reviewId, e instanceof Error ? e.message : e);
  }
}

/**
 * Obrađuje recenzije tvrtke koje čekaju upozorenje (low_alert_at je null). Poziva se na kraju syncReviews; nikad ne baca
 * (greška upozorenja ne smije srušiti sinkronizaciju recenzija).
 */
export async function processLowReviewAlerts(organizationId: string): Promise<AlertRunResult> {
  const result: AlertRunResult = { sent: 0, failed: 0, skipped: 0 };
  try {
    const [org] = await db
      .select({
        name: organizations.name,
        timezone: organizations.timezone,
        isDemo: organizations.isDemo,
        lowReviewAlerts: organizations.lowReviewAlerts,
        contactEmail: organizations.contactEmail,
        contactName: organizations.contactName,
        googlePlaceId: organizations.googlePlaceId,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) return result;

    const since = new Date(Date.now() - LOW_REVIEW_WINDOW_DAYS * 86_400_000);
    const pending = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.organizationId, organizationId),
          isNull(reviews.lowAlertAt),
          lte(reviews.rating, LOW_REVIEW_MAX_RATING),
          gte(reviews.reviewedAt, since)
        )
      )
      .orderBy(asc(reviews.reviewedAt))
      .limit(MAX_PER_RUN);

    let lastSendAt = 0;
    for (const r of pending) {
      const elig = alertEligibility({
        rating: r.rating,
        reviewedAt: r.reviewedAt,
        isDemo: org.isDemo,
        lowReviewAlerts: org.lowReviewAlerts,
        contactEmail: org.contactEmail,
      });
      // Zauzmi redak (atomarno). Tko ne uspije, taj je izgubio utrku: netko drugi ga obrađuje.
      const claimed = await db
        .update(reviews)
        .set({ lowAlertAt: new Date() })
        .where(and(eq(reviews.id, r.id), isNull(reviews.lowAlertAt)))
        .returning({ id: reviews.id });
      if (claimed.length === 0) continue;
      if (!elig.ok) {
        // Prekidač je u međuvremenu isključen ili je nestao e-mail: redak ostaje obrađen, ništa se ne šalje.
        result.skipped++;
        continue;
      }

      let suggested: string | null = null;
      let aiDrafted = false;
      if (integrations.ai()) {
        try {
          suggested = await suggestReply({ rating: r.rating, comment: r.comment, reviewerName: r.reviewerName }, org.name);
          aiDrafted = Boolean(suggested);
        } catch (e) {
          if (!(e instanceof AiNotConfiguredError)) console.error("[review-alerts] AI prijedlog nije uspio", e instanceof Error ? e.message : e);
        }
      }

      try {
        const mail = buildLowReviewEmail({
          orgName: org.name,
          recipientName: org.contactName,
          reviewerName: r.reviewerName,
          rating: r.rating,
          comment: r.comment,
          reviewedAt: r.reviewedAt,
          timezone: org.timezone,
          replyUrl: googleReplyUrl(org.googlePlaceId),
          suggestedReply: suggested,
          aiDrafted,
          settingsUrl: `${env.appUrl}/recenzije/postavke`,
          contactEmail: env.salesEmail,
        });
        const wait = SEND_PACING_MS - (Date.now() - lastSendAt);
        if (lastSendAt > 0 && wait > 0) await sleep(wait);
        const res = await sendEmail(elig.email, mail.subject, mail.html, mail.text);
        lastSendAt = Date.now();
        if (!res.ok) {
          await releaseClaim(r.id);
          result.failed++;
          continue;
        }
        result.sent++;
      } catch (e) {
        console.error("[review-alerts] slanje nije uspjelo", e instanceof Error ? e.message : e);
        await releaseClaim(r.id);
        result.failed++;
      }
    }
  } catch (e) {
    console.error("[review-alerts] obrada nije uspjela", e instanceof Error ? e.message : e);
  }
  return result;
}
