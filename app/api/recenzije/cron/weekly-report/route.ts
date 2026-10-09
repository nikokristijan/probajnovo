import { runWeeklyReports } from "@/lib/recenzije/services/weekly-report";
import { cronAuthorized } from "../_auth";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tjedni izvještaj vlasnicima (ponedjeljkom ujutro). Preskače demo i tvrtke koje su izvještaj
 * dobile u zadnjih 6 dana; bez RESEND_API_KEY ništa ne šalje. Vraća sažetak poslano/preskočeno/neuspjelo.
 * `?dry=1` samo prikaže što bi se poslalo: bez emaila i bez zapisa.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  await ensureReviewsDb();
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const result = await runWeeklyReports({ dryRun });
  return Response.json(result);
}
