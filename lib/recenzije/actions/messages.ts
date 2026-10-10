"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { clients, messageTemplates, services } from "@/lib/recenzije/db/schema";
import type { ActionState } from "@/lib/recenzije/action";
import { defaultCountryCode, toE164 } from "@/lib/recenzije/phone";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { requireOrg, requireWritableOrg } from "@/lib/recenzije/session";
import { AiNotConfiguredError, generateSmsVariants } from "@/lib/recenzije/services/ai";
import { isSkippedSend, skippedNote } from "@/lib/recenzije/menu-send-rules";
import { sendClientMessage, sendTestMessage } from "@/lib/recenzije/services/messaging";

const body = z.string().trim().min(5, "Najprije napišite poruku").max(1000, "Najviše 1.000 znakova");

const aiInput = z.object({
  kind: z.enum(["request", "follow_up"]),
  tone: z.enum(["friendly", "professional", "short"]),
  language: z.string().trim().min(2).max(30),
  instructions: z.string().trim().max(500).optional().default(""),
  clientId: z.string().max(40).optional().default(""),
});

export async function generateMessageAction(input: z.input<typeof aiInput>): Promise<ActionState> {
  const ctx = await requireOrg();
  const parsed = aiInput.safeParse(input);
  if (!parsed.success) return { error: "Neispravne opcije" };
  const rl = rateLimit(`ai:${ctx.org.id}`, 20, 60_000);
  if (!rl.ok) return { error: "Previše AI zahtjeva. Pričekajte minutu." };
  const d = parsed.data;

  let clientCtx: { firstName?: string; service?: string | null; technician?: string | null } = {};
  if (d.clientId) {
    const [row] = await db
      .select({ firstName: clients.firstName, service: services.name, technician: services.technician })
      .from(clients)
      .leftJoin(services, eq(services.clientId, clients.id))
      .where(and(eq(clients.id, d.clientId), eq(clients.organizationId, ctx.org.id)))
      .limit(1);
    if (row) clientCtx = row;
  }
  try {
    const variants = await generateSmsVariants(
      {
        businessName: ctx.org.name,
        industry: ctx.org.industry,
        kind: d.kind,
        tone: d.tone,
        language: d.language,
        instructions: d.instructions,
        clientFirstName: clientCtx.firstName,
        service: clientCtx.service,
        technician: clientCtx.technician,
      },
      3
    );
    return { ok: true, data: { variants } };
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return { error: e.message, data: { code: "AI_NOT_CONFIGURED" } };
    return { error: e instanceof Error ? e.message : "AI request failed" };
  }
}

export async function saveTemplateAction(input: { id?: string; name: string; kind: string; body: string }): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const parsed = z
    .object({
      id: z.string().max(40).optional(),
      name: z.string().trim().min(2, "Dajte predlošku ime").max(60),
      kind: z.enum(["REVIEW_REQUEST", "FOLLOW_UP", "MANUAL"]),
      body,
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.id) {
    const [row] = await db
      .update(messageTemplates)
      .set({ name: d.name, kind: d.kind, body: d.body })
      .where(and(eq(messageTemplates.id, d.id), eq(messageTemplates.organizationId, ctx.org.id)))
      .returning();
    if (!row) return { error: "Predložak nije pronađen" };
  } else {
    await db.insert(messageTemplates).values({ organizationId: ctx.org.id, name: d.name, kind: d.kind, body: d.body });
  }
  revalidatePath("/recenzije/poruke");
  return { ok: true, message: "Predložak spremljen" };
}

export async function deleteTemplateAction(id: string): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  await db.delete(messageTemplates).where(and(eq(messageTemplates.id, id), eq(messageTemplates.organizationId, ctx.org.id)));
  revalidatePath("/recenzije/poruke");
  return { ok: true, message: "Predložak obrisan" };
}

export async function sendTestAction(to: string, text: string): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const rl = rateLimit(`test:${ctx.org.id}`, 10, 60_000);
  if (!rl.ok) return { error: "Previše testnih poruka. Pričekajte minutu." };
  const phone = toE164(to, defaultCountryCode(ctx.org.timezone));
  if (!phone) return { error: "Upišite ispravan broj za test" };
  const b = body.safeParse(text);
  if (!b.success) return { error: b.error.issues[0].message };
  // Test messages use sample values so the owner sees what a client would get.
  const preview = b.data
    .replaceAll("{first_name}", ctx.user.name?.split(" ")[0] || "Ana")
    .replaceAll("{last_name}", "")
    .replaceAll("{business_name}", ctx.org.name)
    .replaceAll("{service}", "servis")
    .replaceAll("{technician}", "nas serviser")
    .replaceAll("{service_date}", `${new Date().getDate()}.${new Date().getMonth() + 1}.`)
    .replaceAll("{review_link}", ctx.org.googleReviewUrl || "(vas link za recenziju)");
  const out = await sendTestMessage(ctx.org.id, phone, `[TEST] ${preview}`);
  revalidatePath("/recenzije/poruke");
  return out.ok ? { ok: true, message: `Test poslan na ${phone}` } : { error: out.error };
}

export async function sendNowAction(clientIds: string[], text: string): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const ids = z.array(z.string().min(1).max(40)).min(1, "Odaberite barem jednog primatelja").max(200).safeParse(clientIds);
  if (!ids.success) return { error: ids.error.issues[0].message };
  const b = body.safeParse(text);
  if (!b.success) return { error: b.error.issues[0].message };
  const rl = rateLimit(`send:${ctx.org.id}`, 60, 60_000);
  if (!rl.ok) return { error: "Previše poruka odjednom. Pričekajte minutu pa pokušajte ponovno." };

  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.org.id), inArray(clients.id, ids.data)));
  const kind = b.data.includes("{review_link}") ? "REVIEW_REQUEST" : "MANUAL";
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const r of rows) {
    const out = await sendClientMessage({ organizationId: ctx.org.id, clientId: r.id, template: b.data, kind });
    if (out.ok) sent++;
    // Gost s jelovnika bez privole za obavijesti (ili noćna pauza): preskače se, ne računa se kao greška.
    else if (isSkippedSend(out.code)) skipped++;
    else {
      errors.push(out.error);
      if (["NOT_CONFIGURED", "NO_REVIEW_URL", "DEMO", "LIMIT"].includes(out.code)) break;
    }
  }
  revalidatePath("/recenzije/poruke");
  revalidatePath("/recenzije/klijenti");
  if (sent === 0) return { error: errors[0] ?? (skipped > 0 ? `Nijedna poruka nije poslana.${skippedNote(skipped)}` : "Poruka nije poslana") };
  return {
    ok: true,
    message: `Poslano ${sent} od ${rows.length}${errors.length ? ` · neuspjelo: ${errors.length}` : ""}${skipped ? ` · preskočeno: ${skipped} (gosti s jelovnika bez privole za obavijesti ili noćna pauza)` : ""}`,
  };
}
