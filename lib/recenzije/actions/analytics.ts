"use server";

import type { ActionState } from "@/lib/recenzije/action";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { requireOrg } from "@/lib/recenzije/session";
import { AiNotConfiguredError, analyzePerformance } from "@/lib/recenzije/services/ai";
import { byService, byTechnician, dashboardStats } from "@/lib/recenzije/services/stats";

export async function analyzePerformanceAction(): Promise<ActionState> {
  const ctx = await requireOrg();
  const rl = rateLimit(`ai:${ctx.org.id}`, 20, 60_000);
  if (!rl.ok) return { error: "Previše AI zahtjeva. Pričekajte minutu." };
  const [s, techs, svcs] = await Promise.all([dashboardStats(ctx.org.id, 30), byTechnician(ctx.org.id), byService(ctx.org.id)]);
  const stats: Record<string, number | string> = {
    "Review requests sent": s.requestsSent,
    "Links clicked": s.linksClicked,
    "Click rate %": s.clickRate,
    "Reviews received (30d)": s.reviewsReceived,
    "Reviews received (previous 30d)": s.reviewsPrev,
    "Conversion rate % (contacted clients who reviewed)": s.conversionRate,
    "Average rating": s.averageRating?.toFixed(2) ?? "n/a",
    "Failed messages": s.failedMessages,
    "Follow-ups scheduled": s.followUpsScheduled,
  };
  for (const t of techs) stats[`Technician ${t.key}: contacted/clicked/reviewed`] = `${t.contacted}/${t.clicked}/${t.reviewed}`;
  for (const t of svcs) stats[`Service ${t.key}: contacted/clicked/reviewed`] = `${t.contacted}/${t.clicked}/${t.reviewed}`;
  try {
    return { ok: true, data: { text: await analyzePerformance(stats) } };
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "AI request failed" };
  }
}
