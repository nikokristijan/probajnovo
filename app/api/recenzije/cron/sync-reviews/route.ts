import { eq, or, isNotNull, and } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { googleConnections, organizations } from "@/lib/recenzije/db/schema";
import { integrations } from "@/lib/recenzije/env";
import { syncReviews } from "@/lib/recenzije/services/google";
import { cronAuthorized } from "../_auth";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Pulls new Google reviews for every connected organization and matches them to clients. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  await ensureReviewsDb();
  const orgs = await db
    .selectDistinct({ id: organizations.id })
    .from(organizations)
    .leftJoin(googleConnections, eq(googleConnections.organizationId, organizations.id))
    .where(
      and(
        eq(organizations.isDemo, false),
        or(
          eq(googleConnections.status, "CONNECTED"),
          integrations.googlePlaces() ? isNotNull(organizations.googlePlaceId) : undefined
        )
      )
    );
  const results: { id: string; ok: boolean; added?: number; error?: string }[] = [];
  for (const o of orgs) {
    try {
      const r = await syncReviews(o.id);
      results.push({ id: o.id, ok: true, added: r.added });
    } catch (e) {
      results.push({ id: o.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return Response.json({ organizations: orgs.length, results });
}
