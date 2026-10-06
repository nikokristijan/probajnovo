"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { automationRuns, campaigns } from "@/lib/recenzije/db/schema";
import type { ActionState } from "@/lib/recenzije/action";
import { requireOrg, requireWritableOrg } from "@/lib/recenzije/session";
import { REVIEW_STATUS_ORDER } from "@/lib/recenzije/status";
import { audienceClients, launchCampaign } from "@/lib/recenzije/services/campaigns";

const schema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2, "Dajte kampanji ime").max(80),
  trigger: z.enum(["LAUNCH", "SERVICE_COMPLETED"]),
  serviceWithinDays: z.coerce.number().int().min(1).max(3650),
  statuses: z.array(z.enum(REVIEW_STATUS_ORDER as [string, ...string[]])).max(6),
  service: z.string().trim().max(80).optional().default(""),
  messageBody: z.string().trim().min(10, "Napišite poruku").max(1000),
  delayMinutes: z.coerce.number().int().min(0).max(60 * 24 * 30),
  followUpEnabled: z.boolean(),
  followUpAfterHours: z.coerce.number().int().min(1).max(24 * 30),
  followUpBody: z.string().trim().max(1000).optional().default(""),
});

export type CampaignInput = z.input<typeof schema>;

export async function saveCampaignAction(input: CampaignInput, launch = false): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Provjerite označena polja", fieldErrors: fe };
  }
  const d = parsed.data;
  if (d.followUpEnabled && d.followUpBody.length < 10) {
    return { error: "Napišite podsjetnik ili ga isključite", fieldErrors: { followUpBody: "Napišite tekst podsjetnika" } };
  }
  const values = {
    name: d.name,
    trigger: d.trigger,
    audience: { serviceWithinDays: d.serviceWithinDays, statuses: d.statuses as never, service: d.service || undefined },
    messageBody: d.messageBody,
    delayMinutes: d.delayMinutes,
    followUpEnabled: d.followUpEnabled,
    followUpAfterHours: d.followUpAfterHours,
    followUpBody: d.followUpBody || null,
  };
  let id = d.id;
  if (id) {
    const [row] = await db
      .update(campaigns)
      .set(values)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, ctx.org.id)))
      .returning();
    if (!row) return { error: "Kampanja nije pronađena" };
  } else {
    const [row] = await db.insert(campaigns).values({ ...values, organizationId: ctx.org.id }).returning();
    id = row.id;
  }
  let message = "Kampanja spremljena";
  if (launch) {
    const r = await launchCampaign(ctx.org.id, id);
    message =
      r.enrolled === 0
        ? "Kampanja je aktivna. Trenutno nijedan klijent ne odgovara publici."
        : `Kampanja pokrenuta za ${r.enrolled} klijenata${r.failed ? `. Neuspjelo: ${r.failed} (${r.firstError})` : ""}`;
  }
  revalidatePath("/recenzije/kampanje");
  return { ok: true, message, data: { id } };
}

export async function audiencePreviewAction(input: { serviceWithinDays: number; statuses: string[]; service?: string }): Promise<ActionState> {
  const ctx = await requireOrg();
  const p = z
    .object({ serviceWithinDays: z.coerce.number().int().min(1).max(3650), statuses: z.array(z.string()).max(6), service: z.string().max(80).optional() })
    .safeParse(input);
  if (!p.success) return { error: "Neispravna publika" };
  const rows = await audienceClients(ctx.org.id, {
    serviceWithinDays: p.data.serviceWithinDays,
    statuses: p.data.statuses.filter((s) => (REVIEW_STATUS_ORDER as string[]).includes(s)) as never,
    service: p.data.service || undefined,
  });
  return { ok: true, data: { count: rows.length, sample: rows.slice(0, 5).map((r) => `${r.firstName} ${r.lastName}`.trim()) } };
}

export async function setCampaignStatusAction(id: string, status: "ACTIVE" | "PAUSED" | "COMPLETED"): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const [c] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, ctx.org.id)))
    .limit(1);
  if (!c) return { error: "Kampanja nije pronađena" };
  if (status === "ACTIVE" && c.status === "DRAFT") {
    const r = await launchCampaign(ctx.org.id, id);
    revalidatePath("/recenzije/kampanje");
    return { ok: true, message: `Pokrenuto za ${r.enrolled} klijenata${r.failed ? `. Neuspjelo: ${r.failed} (${r.firstError})` : ""}` };
  }
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
  if (status === "COMPLETED") {
    // Ending a campaign stops anything it still had scheduled.
    await db
      .update(automationRuns)
      .set({ status: "CANCELLED", finishedAt: new Date(), error: "Kampanja završena" })
      .where(and(eq(automationRuns.campaignId, id), inArray(automationRuns.status, ["RUNNING", "WAITING"])));
  }
  revalidatePath("/recenzije/kampanje");
  return { ok: true, message: status === "PAUSED" ? "Kampanja pauzirana" : status === "ACTIVE" ? "Kampanja nastavljena" : "Kampanja završena" };
}

export async function deleteCampaignAction(id: string) {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return;
  await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.organizationId, ctx.org.id)));
  revalidatePath("/recenzije/kampanje");
  redirect("/recenzije/kampanje");
}
