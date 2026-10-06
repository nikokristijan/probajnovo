import { processDueRuns } from "@/lib/recenzije/services/automation-engine";
import { cronAuthorized } from "../_auth";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Advances automation runs whose wait has elapsed (follow-ups, delayed requests). */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  await ensureReviewsDb();
  const result = await processDueRuns(100);
  return Response.json(result);
}
