"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { automationRuns, automations, clients } from "@/lib/recenzije/db/schema";
import type { ActionState } from "@/lib/recenzije/action";
import { AUTOMATION_TEMPLATES } from "@/lib/recenzije/automation/templates";
import { createId } from "@/lib/recenzije/id";
import { requireWritableOrg } from "@/lib/recenzije/session";
import { triggerAutomations } from "@/lib/recenzije/services/automation-engine";

const template = z.string().trim().min(5, "Poruka je prekratka").max(1000);
const stepSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().max(40), type: z.literal("wait"), minutes: z.number().int().min(1).max(60 * 24 * 60) }),
  z.object({ id: z.string().max(40), type: z.literal("send_review_request"), template }),
  z.object({ id: z.string().max(40), type: z.literal("send_follow_up"), template }),
  z.object({ id: z.string().max(40), type: z.literal("send_message"), template }),
  z.object({
    id: z.string().max(40),
    type: z.literal("condition"),
    check: z.enum(["clicked", "reviewed"]),
    ifTrue: z.enum(["end", "continue"]),
    ifFalse: z.enum(["end", "continue"]),
  }),
]);

const automationSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(2, "Dajte automatizaciji ime").max(80),
  description: z.string().trim().max(300).optional().default(""),
  trigger: z.enum(["SERVICE_COMPLETED", "CLIENT_CREATED", "MANUAL"]),
  enabled: z.boolean(),
  steps: z.array(stepSchema).min(1, "Dodajte barem jedan korak").max(20, "Najviše 20 koraka"),
});

export async function createAutomationAction(templateKey: string) {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return;
  const t = AUTOMATION_TEMPLATES.find((x) => x.key === templateKey) ?? AUTOMATION_TEMPLATES.at(-1)!;
  const [row] = await db
    .insert(automations)
    .values({
      organizationId: ctx.org.id,
      name: t.name,
      description: t.description,
      trigger: t.trigger,
      templateKey: t.key,
      enabled: false,
      steps: t.steps.map((s) => ({ ...s, id: createId() })) as never,
    })
    .returning();
  redirect(`/recenzije/automatizacije/${row.id}`);
}

export async function saveAutomationAction(input: z.input<typeof automationSchema>): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const parsed = automationSchema.safeParse(input);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: i.path.includes("steps") && i.path.length > 1 ? `Korak ${Number(i.path[1]) + 1}: ${i.message}` : i.message };
  }
  const d = parsed.data;
  const sends = d.steps.some((s) => s.type.startsWith("send_"));
  if (!sends) return { error: "Dodajte barem jedan korak koji šalje poruku" };
  const [row] = await db
    .update(automations)
    .set({ name: d.name, description: d.description || null, trigger: d.trigger, enabled: d.enabled, steps: d.steps })
    .where(and(eq(automations.id, d.id), eq(automations.organizationId, ctx.org.id)))
    .returning();
  if (!row) return { error: "Automatizacija nije pronađena" };
  revalidatePath("/recenzije/automatizacije");
  revalidatePath(`/recenzije/automatizacije/${d.id}`);
  return { ok: true, message: d.enabled ? "Spremljeno. Automatizacija je uključena." : "Spremljeno. Automatizacija je isključena." };
}

export async function toggleAutomationAction(id: string, enabled: boolean): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const [row] = await db
    .update(automations)
    .set({ enabled })
    .where(and(eq(automations.id, id), eq(automations.organizationId, ctx.org.id)))
    .returning();
  if (!row) return { error: "Automatizacija nije pronađena" };
  if (!enabled) {
    // Turning an automation off also stops anything it had scheduled.
    await db
      .update(automationRuns)
      .set({ status: "CANCELLED", finishedAt: new Date(), error: "Automatizacija isključena" })
      .where(and(eq(automationRuns.automationId, id), inArray(automationRuns.status, ["RUNNING", "WAITING"])));
  }
  revalidatePath("/recenzije/automatizacije");
  return { ok: true, message: enabled ? `${row.name}: uključeno` : `${row.name}: isključeno, zakazani koraci su otkazani.` };
}

export async function deleteAutomationAction(id: string) {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return;
  await db.delete(automations).where(and(eq(automations.id, id), eq(automations.organizationId, ctx.org.id)));
  revalidatePath("/recenzije/automatizacije");
  redirect("/recenzije/automatizacije");
}

export async function runAutomationForClientsAction(id: string, clientIds: string[]): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const ids = z.array(z.string().min(1).max(40)).min(1, "Odaberite barem jednog klijenta").max(200).safeParse(clientIds);
  if (!ids.success) return { error: ids.error.issues[0].message };
  const [a] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.organizationId, ctx.org.id)))
    .limit(1);
  if (!a) return { error: "Automatizacija nije pronađena" };
  if (!a.enabled) return { error: "Najprije uključite automatizaciju" };
  const valid = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.org.id), inArray(clients.id, ids.data)));
  let started = 0;
  for (const c of valid) {
    const runs = await triggerAutomations({ organizationId: ctx.org.id, trigger: a.trigger, clientId: c.id, automationId: a.id });
    started += runs.length;
  }
  revalidatePath(`/recenzije/automatizacije/${id}`);
  return { ok: true, message: started ? `Pokrenuto za ${started} klijenata` : "Već je pokrenuto za ove klijente" };
}
