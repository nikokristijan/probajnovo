import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, linkClicks, trackingLinks } from "@/lib/recenzije/db/schema";
import { createToken } from "@/lib/recenzije/id";
import { env } from "@/lib/recenzije/env";
import { sha256 } from "@/lib/recenzije/crypto";
import { logActivity } from "./activity";
import { fullName } from "@/lib/recenzije/utils";

export function trackingUrl(token: string, base = env.appUrl) {
  return `${base}/r/${token}`;
}

/** Poveznica za odjavu: isti token kao /r/<token>, pa nr_tracking_links već veže token na klijenta i tvrtku. */
export function optOutUrl(token: string, base = env.appUrl) {
  return `${base}/o/${token}`;
}

export async function createTrackingLink(organizationId: string, clientId: string, destinationUrl: string) {
  const token = createToken(10);
  const [link] = await db
    .insert(trackingLinks)
    .values({ organizationId, clientId, token, destinationUrl })
    .returning();
  return { link, url: trackingUrl(token) };
}

/**
 * Token za poveznicu za odjavu u poruci koja nema {review_link}: koristi se zadnja poveznica klijenta,
 * a ako je nema, stvara se nova (odredište je Google stranica tvrtke, inače naslovnica). Nema promjene sheme.
 */
export async function getOrCreateClientToken(organizationId: string, clientId: string, fallbackDestination: string | null) {
  const [existing] = await db
    .select({ token: trackingLinks.token })
    .from(trackingLinks)
    .where(and(eq(trackingLinks.organizationId, organizationId), eq(trackingLinks.clientId, clientId)))
    .orderBy(desc(trackingLinks.createdAt))
    .limit(1);
  if (existing) return existing.token;
  const { link } = await createTrackingLink(organizationId, clientId, fallbackDestination || env.appUrl);
  return link.token;
}

/**
 * Records a click on /r/{token} and returns where to redirect. The first click
 * moves the client to CLICKED (never backwards from REVIEW_RECEIVED/COMPLETED).
 */
export async function recordClick(token: string, meta: { userAgent?: string | null; ip?: string | null }) {
  const [link] = await db.select().from(trackingLinks).where(eq(trackingLinks.token, token)).limit(1);
  if (!link) return null;

  const now = new Date();
  // Link-preview bots (iMessage, WhatsApp, Slack…) fetch URLs too; don't count them as clicks.
  const ua = meta.userAgent || "";
  const isBot = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slack|telegram|discord|skype/i.test(ua);
  if (isBot) return link.destinationUrl;

  await db.insert(linkClicks).values({ linkId: link.id, userAgent: ua.slice(0, 300), ipHash: meta.ip ? sha256(meta.ip) : null });
  await db
    .update(trackingLinks)
    .set({
      clickCount: sql`${trackingLinks.clickCount} + 1`,
      lastClickedAt: now,
      firstClickedAt: link.firstClickedAt ?? now,
    })
    .where(eq(trackingLinks.id, link.id));

  if (!link.firstClickedAt) {
    const [client] = await db
      .update(clients)
      .set({ reviewStatus: "CLICKED" })
      .where(
        and(
          eq(clients.id, link.clientId),
          sql`${clients.reviewStatus} in ('NOT_CONTACTED','REQUEST_SENT','FOLLOW_UP_SCHEDULED')`
        )
      )
      .returning();
    const [c] = client ? [client] : await db.select().from(clients).where(eq(clients.id, link.clientId)).limit(1);
    await logActivity({
      organizationId: link.organizationId,
      clientId: link.clientId,
      type: "link_clicked",
      title: `${c ? fullName(c) : "Klijent"} je kliknuo/la link za recenziju`,
    });
  }
  return link.destinationUrl;
}
