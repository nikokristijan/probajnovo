import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { clients, googleConnections, organizations, reviews } from "@/lib/recenzije/db/schema";
import { decrypt, encrypt, randomToken } from "@/lib/recenzije/crypto";
import { derivedKey, env, integrations } from "@/lib/recenzije/env";
import { fullName } from "@/lib/recenzije/utils";
import { logActivity } from "./activity";
import { cancelActiveRunsForClient } from "./automation-engine";

/**
 * Google Business Profile integration (real OAuth 2.0, no mocks).
 * Scope business.manage is required to read all reviews and reply to them.
 * Note: Google must approve your Cloud project for the Business Profile APIs
 * (https://developers.google.com/my-business/content/prereqs) — until then the
 * API returns 403 and we surface that error instead of pretending to sync.
 */
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/business.manage"];
const REDIRECT_PATH = "/api/recenzije/google/callback";

export function googleRedirectUri() {
  return `${env.appUrl}${REDIRECT_PATH}`;
}

// ── OAuth state: HMAC-signed, bound to org + user, 10 min expiry ──

function sign(payload: string) {
  return createHmac("sha256", derivedKey("nr-oauth-state")).update(payload).digest("base64url");
}

export function createOAuthState(organizationId: string, userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ o: organizationId, u: userId, n: randomToken(8), e: Date.now() + 10 * 60_000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: string): { organizationId: string; userId: string } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { o: string; u: string; e: number };
  if (Date.now() > data.e) return null;
  return { organizationId: data.o, userId: data.u };
}

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope: string; error?: string; error_description?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.googleClientId, client_secret: env.googleClientSecret, ...body }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) throw new Error(json.error_description || json.error || "Google prijava nije uspjela");
  return json;
}

/** Handles the OAuth callback: stores encrypted tokens, discovers the business location. */
export async function completeGoogleConnection(organizationId: string, code: string) {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() });
  const info = (await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).then((r) => r.json())) as { email?: string };

  const values = {
    organizationId,
    googleEmail: info.email ?? null,
    accessTokenEnc: encrypt(tokens.access_token),
    refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    expiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
    scope: tokens.scope,
    status: "CONNECTED",
    lastError: null,
  };
  await db
    .insert(googleConnections)
    .values(values)
    .onConflictDoUpdate({
      target: googleConnections.organizationId,
      set: { ...values, ...(values.refreshTokenEnc ? {} : { refreshTokenEnc: undefined }) },
    });

  try {
    await discoverLocation(organizationId);
  } catch (e) {
    await db
      .update(googleConnections)
      .set({ status: "ERROR", lastError: e instanceof Error ? e.message : String(e) })
      .where(eq(googleConnections.organizationId, organizationId));
  }
}

async function accessToken(organizationId: string): Promise<string> {
  const [conn] = await db.select().from(googleConnections).where(eq(googleConnections.organizationId, organizationId)).limit(1);
  if (!conn?.accessTokenEnc) throw new Error("Najprije povežite Google Business Profile.");
  if (conn.expiresAt && conn.expiresAt.getTime() > Date.now()) return decrypt(conn.accessTokenEnc);
  if (!conn.refreshTokenEnc) throw new Error("Google veza je istekla. Ponovno povežite Google Business Profile.");
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(conn.refreshTokenEnc) });
  await db
    .update(googleConnections)
    .set({ accessTokenEnc: encrypt(t.access_token), expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) })
    .where(eq(googleConnections.id, conn.id));
  return t.access_token;
}

async function gapi<T>(organizationId: string, url: string, init?: RequestInit): Promise<T> {
  const token = await accessToken(organizationId);
  const res = await fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
  if (!res.ok) {
    const msg = json.error?.message || `Google API greška ${res.status}`;
    throw new Error(res.status === 403 ? `${msg} (Je li Business Profile API uključen i odobren za ovaj Google Cloud projekt?)` : msg);
  }
  return json;
}

/** Picks the first account + location and stores the review URL Google gives us. */
export async function discoverLocation(organizationId: string) {
  const accounts = await gapi<{ accounts?: { name: string; accountName?: string }[] }>(
    organizationId,
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
  );
  const account = accounts.accounts?.[0];
  if (!account) throw new Error("Ovaj Google račun nema Google Business Profile.");
  const locs = await gapi<{ locations?: { name: string; title?: string; metadata?: { placeId?: string; newReviewUri?: string } }[] }>(
    organizationId,
    `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,metadata&pageSize=10`
  );
  const loc = locs.locations?.[0];
  if (!loc) throw new Error("Ovaj Google račun nema nijednu poslovnu lokaciju.");
  await db
    .update(googleConnections)
    .set({ accountName: account.name, locationName: loc.name, locationTitle: loc.title ?? null, status: "CONNECTED", lastError: null })
    .where(eq(googleConnections.organizationId, organizationId));
  const placeId = loc.metadata?.placeId;
  await db
    .update(organizations)
    .set({
      ...(placeId ? { googlePlaceId: placeId } : {}),
      ...(loc.metadata?.newReviewUri
        ? { googleReviewUrl: loc.metadata.newReviewUri }
        : placeId
          ? { googleReviewUrl: reviewUrlForPlace(placeId) }
          : {}),
    })
    .where(eq(organizations.id, organizationId));
}

export function reviewUrlForPlace(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

type IncomingReview = {
  externalId: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  reviewedAt: Date;
  replyText: string | null;
  repliedAt: Date | null;
};

export type SyncResult = { source: "business_profile" | "places"; fetched: number; added: number; matched: number; partial: boolean; rating?: number | null; total?: number | null };

/**
 * Pulls reviews from Google. Business Profile API (all reviews) when connected;
 * otherwise the Places API, which only returns up to 5 reviews — the result is
 * flagged `partial` so the UI can say so.
 */
export async function syncReviews(organizationId: string): Promise<SyncResult> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const [conn] = await db.select().from(googleConnections).where(eq(googleConnections.organizationId, organizationId)).limit(1);

  let incoming: IncomingReview[] = [];
  let source: SyncResult["source"];
  let rating: number | null = null;
  let total: number | null = null;

  if (conn?.status === "CONNECTED" && conn.accountName && conn.locationName) {
    source = "business_profile";
    let pageToken = "";
    for (let page = 0; page < 10; page++) {
      const data = await gapi<{
        reviews?: { reviewId: string; reviewer?: { displayName?: string }; starRating?: string; comment?: string; createTime: string; reviewReply?: { comment?: string; updateTime?: string } }[];
        averageRating?: number;
        totalReviewCount?: number;
        nextPageToken?: string;
      }>(organizationId, `https://mybusiness.googleapis.com/v4/${conn.accountName}/${conn.locationName}/reviews?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ""}`);
      rating = data.averageRating ?? rating;
      total = data.totalReviewCount ?? total;
      for (const r of data.reviews ?? []) {
        incoming.push({
          externalId: r.reviewId,
          reviewerName: r.reviewer?.displayName || "Google korisnik",
          rating: STAR[r.starRating || ""] || 0,
          comment: r.comment ?? null,
          reviewedAt: new Date(r.createTime),
          replyText: r.reviewReply?.comment ?? null,
          repliedAt: r.reviewReply?.updateTime ? new Date(r.reviewReply.updateTime) : null,
        });
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    await db.update(googleConnections).set({ lastSyncedAt: new Date(), lastError: null }).where(eq(googleConnections.id, conn.id));
  } else if (integrations.googlePlaces() && org.googlePlaceId) {
    source = "places";
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(org.googlePlaceId)}`, {
      headers: { "X-Goog-Api-Key": env.googlePlacesKey, "X-Goog-FieldMask": "rating,userRatingCount,reviews" },
    });
    const data = (await res.json()) as {
      rating?: number;
      userRatingCount?: number;
      reviews?: { name: string; rating: number; text?: { text?: string }; authorAttribution?: { displayName?: string }; publishTime: string }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(data.error?.message || `Places API greška ${res.status}`);
    rating = data.rating ?? null;
    total = data.userRatingCount ?? null;
    incoming = (data.reviews ?? []).map((r) => ({
      externalId: r.name,
      reviewerName: r.authorAttribution?.displayName || "Google korisnik",
      rating: r.rating,
      comment: r.text?.text ?? null,
      reviewedAt: new Date(r.publishTime),
      replyText: null,
      repliedAt: null,
    }));
  } else {
    throw new Error("Za preuzimanje recenzija povežite Google Business Profile (ili postavite Place ID i GOOGLE_PLACES_API_KEY).");
  }

  await db
    .update(organizations)
    .set({ googleRating: rating, googleReviewCount: total, googleSyncedAt: new Date() })
    .where(eq(organizations.id, organizationId));

  let added = 0;
  let matched = 0;
  for (const r of incoming) {
    const inserted = await db
      .insert(reviews)
      .values({ organizationId, source: "GOOGLE", ...r })
      .onConflictDoUpdate({
        target: [reviews.organizationId, reviews.externalId],
        set: { rating: r.rating, comment: r.comment, replyText: r.replyText, repliedAt: r.repliedAt },
      })
      .returning({ id: reviews.id, clientId: reviews.clientId, createdAt: reviews.createdAt });
    const row = inserted[0];
    const isNew = row && Date.now() - row.createdAt.getTime() < 60_000;
    if (isNew) added++;
    if (row && !row.clientId) {
      const ok = await attributeReview(organizationId, row.id, r);
      if (ok) matched++;
    }
  }
  return { source, fetched: incoming.length, added, matched, partial: source === "places", rating, total };
}

function norm(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ties a review to a client only on an exact (accent-insensitive) full-name match
 * among clients who were actually sent a request before the review date.
 * Anything else stays unattributed and can be linked manually in the UI.
 */
async function attributeReview(organizationId: string, reviewId: string, r: IncomingReview) {
  const candidates = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.organizationId, organizationId),
        inArray(clients.reviewStatus, ["REQUEST_SENT", "CLICKED", "FOLLOW_UP_SCHEDULED"])
      )
    );
  const target = norm(r.reviewerName);
  const hits = candidates.filter(
    (c) => norm(fullName(c)) === target && c.lastMessageAt && c.lastMessageAt <= r.reviewedAt
  );
  if (hits.length !== 1) return false;
  await markReviewReceived(organizationId, hits[0].id, reviewId, "NAME_MATCH", r.reviewedAt, r.rating);
  return true;
}

export async function markReviewReceived(
  organizationId: string,
  clientId: string,
  reviewId: string | null,
  match: "NAME_MATCH" | "MANUAL",
  at: Date,
  rating?: number
) {
  const [client] = await db
    .update(clients)
    .set({ reviewStatus: "REVIEW_RECEIVED", reviewReceivedAt: at, nextFollowUpAt: null })
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .returning();
  if (!client) return;
  if (reviewId) {
    await db.update(reviews).set({ clientId, match }).where(and(eq(reviews.id, reviewId), eq(reviews.organizationId, organizationId)));
  }
  await cancelActiveRunsForClient(organizationId, clientId, "Recenzija primljena, tijek završen");
  await logActivity({
    organizationId,
    clientId,
    type: "review_received",
    title: rating ? `${rating}★ recenzija od ${fullName(client)}` : `Recenzija od ${fullName(client)}`,
    meta: { match },
  });
}

export async function replyToReview(organizationId: string, externalId: string, comment: string) {
  const [conn] = await db.select().from(googleConnections).where(eq(googleConnections.organizationId, organizationId)).limit(1);
  if (!conn?.accountName || !conn.locationName) throw new Error("Za odgovaranje na recenzije povežite Google Business Profile.");
  await gapi(organizationId, `https://mybusiness.googleapis.com/v4/${conn.accountName}/${conn.locationName}/reviews/${externalId}/reply`, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
  await db
    .update(reviews)
    .set({ replyText: comment, repliedAt: new Date() })
    .where(and(eq(reviews.organizationId, organizationId), eq(reviews.externalId, externalId)));
}

export async function disconnectGoogle(organizationId: string) {
  await db.delete(googleConnections).where(eq(googleConnections.organizationId, organizationId));
}

// ── Prijava Google računom (openid) — odvojeno od Business Profile veze ──

export const LOGIN_REDIRECT_PATH = "/api/recenzije/auth/google/callback";

export function googleLoginUrl(state: string) {
  const p = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: `${env.appUrl}${LOGIN_REDIRECT_PATH}`,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Zamijeni kod za podatke o korisniku. Vraća samo potvrđene (verified) emailove. */
export async function googleLoginProfile(code: string) {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: `${env.appUrl}${LOGIN_REDIRECT_PATH}` });
  const info = (await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).then((r) => r.json())) as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!info.sub || !info.email || !info.email_verified) throw new Error("Google nije potvrdio email adresu.");
  return { googleId: info.sub, email: info.email.toLowerCase(), name: info.name ?? null, image: info.picture ?? null };
}
