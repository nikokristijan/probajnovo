import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { kickDueRuns } from "@/lib/recenzije/services/automation-kick";

export const dynamic = "force-dynamic";

/**
 * Javni "okidač": svaki posjet bilo kojoj stranici probajnovo.com (vidi components/AutomationKick.tsx) ovdje
 * pokreće obradu dospjelih poruka (npr. recenzije gostima iz jelovnika), pa slanje ne ovisi samo o dnevnom cronu.
 * Ništa ne vraća i ne prima; bez prava je beskoristan napadaču, a obrada je ograničena na jedan poziv u 15 s po procesu.
 */
export async function POST() {
  try {
    await ensureReviewsDb();
    kickDueRuns(25);
  } catch (e) {
    console.error("[recenzije] kick", e);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
