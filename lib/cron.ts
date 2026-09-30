import { NextResponse } from "next/server";
import { recordCronRun } from "@/lib/db/queries";

/**
 * Zajednička provjera za sve /api/cron/* rute (plan #4).
 *
 * Ranije: ako CRON_SECRET nije postavljen, ruta je radila za SVAKOGA tko zna
 * adresu (npr. mogao je okinuti slanje podsjetnika gostima ili prebrisati
 * iCal blokade). Sad:
 *  - CRON_SECRET postavljen → traži se točno "Authorization: Bearer <tajna>"
 *    (Vercel ga šalje sam kad je varijabla postavljena).
 *  - CRON_SECRET NIJE postavljen → propušta se samo poziv koji se predstavlja
 *    kao Vercel Cron (user-agent "vercel-cron/…"). To je slabija zaštita, zato
 *    Postavke → "Automatski poslovi" upozorava dok tajna nije postavljena.
 */
export function authorizeCron(req: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    if (req.headers.get("authorization") !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua.toLowerCase().startsWith("vercel-cron")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.warn("[cron] CRON_SECRET nije postavljen — propušteno samo zbog vercel-cron user-agenta.");
  return null;
}

export function isCronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET);
}

/**
 * Pokreće posao i zapisuje ishod (plan #30) — vrijeme, uspjeh, kratki sažetak
 * ili poruku greške — da se u adminu vidi kad je koji automatski posao
 * zadnji put radio. Zapis ishoda nikad ne ruši sam posao.
 */
export async function runCron(name: string, work: () => Promise<NextResponse>): Promise<NextResponse> {
  const startedAt = new Date();
  try {
    const res = await work();
    let summary = "";
    try {
      summary = JSON.stringify(await res.clone().json()).slice(0, 500);
    } catch {
      summary = "";
    }
    await recordCronRun({ name, ok: res.ok, summary, startedAt }).catch(() => {});
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun({ name, ok: false, summary: message.slice(0, 500), startedAt }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
