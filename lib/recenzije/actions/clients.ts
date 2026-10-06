"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { clients, messageTemplates, services } from "@/lib/recenzije/db/schema";
import { type ActionState, echoValues, formObject, zodErrors } from "@/lib/recenzije/action";
import { DEFAULT_REQUEST } from "@/lib/recenzije/automation/templates";
import { defaultCountryCode, toE164 } from "@/lib/recenzije/phone";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { requireWritableOrg } from "@/lib/recenzije/session";
import { fullName } from "@/lib/recenzije/utils";
import { logActivity } from "@/lib/recenzije/services/activity";
import { cancelActiveRunsForClient, triggerAutomations } from "@/lib/recenzije/services/automation-engine";
import { markReviewReceived } from "@/lib/recenzije/services/google";
import { sendClientMessage, type SendOutcome } from "@/lib/recenzije/services/messaging";

const clientSchema = z.object({
  firstName: z.string().trim().min(1, "Upišite ime").max(60),
  lastName: z.string().trim().max(60).optional().default(""),
  phone: z.string().trim().min(5, "Upišite broj mobitela").max(30),
  email: z.union([z.literal(""), z.string().trim().email("Upišite ispravan email").max(200)]).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

const serviceSchema = z.object({
  service: z.string().trim().max(80).optional().default(""),
  serviceDate: z.string().trim().optional().default(""),
  technician: z.string().trim().max(80).optional().default(""),
  completed: z.string().optional(),
});

function parseDate(v: string) {
  if (!v) return new Date();
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function completeService(orgId: string, clientId: string, serviceId: string, name: string, label: string) {
  await db
    .update(services)
    .set({ completedAt: new Date() })
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)));
  await logActivity({
    organizationId: orgId,
    clientId,
    type: "service_completed",
    title: `${label} završena za ${name}`,
  });
  return triggerAutomations({ organizationId: orgId, trigger: "SERVICE_COMPLETED", clientId, serviceId });
}

export async function createClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const raw = formObject(fd);
  const c = clientSchema.safeParse(raw);
  const s = serviceSchema.safeParse(raw);
  if (!c.success || !s.success) {
    return { values: echoValues(fd), fieldErrors: { ...(c.success ? {} : zodErrors(c.error)), ...(s.success ? {} : zodErrors(s.error)) } };
  }
  const phone = toE164(c.data.phone, defaultCountryCode(ctx.org.timezone));
  if (!phone) return { values: echoValues(fd), fieldErrors: { phone: "Upišite ispravan broj, npr. 091 234 5678" } };
  const serviceDate = parseDate(s.data.serviceDate);
  if (!serviceDate) return { values: echoValues(fd), fieldErrors: { serviceDate: "Upišite ispravan datum" } };

  const [dupe] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.org.id), eq(clients.phone, phone)))
    .limit(1);
  if (dupe) return { values: echoValues(fd), fieldErrors: { phone: "Klijent s ovim brojem već postoji" } };

  const [client] = await db
    .insert(clients)
    .values({
      organizationId: ctx.org.id,
      firstName: c.data.firstName,
      lastName: c.data.lastName,
      phone,
      email: c.data.email || null,
      notes: c.data.notes || null,
    })
    .returning();
  const name = fullName(client);
  await logActivity({ organizationId: ctx.org.id, clientId: client.id, type: "client_created", title: `Dodan klijent ${name}` });

  let workflowNote = "";
  if (s.data.service) {
    const [svc] = await db
      .insert(services)
      .values({
        organizationId: ctx.org.id,
        clientId: client.id,
        name: s.data.service,
        technician: s.data.technician || null,
        serviceDate,
      })
      .returning();
    if (s.data.completed === "on") {
      const runs = await completeService(ctx.org.id, client.id, svc.id, name, s.data.service);
      workflowNote = runs.length ? ` Automatizacija je pokrenuta.` : "";
    }
  }
  await triggerAutomations({ organizationId: ctx.org.id, trigger: "CLIENT_CREATED", clientId: client.id });
  revalidatePath("/recenzije/klijenti");
  revalidatePath("/recenzije/pregled");
  if (raw.open === "1") redirect(`/recenzije/klijenti/${client.id}?added=1`);
  return { ok: true, message: `Klijent ${name} dodan.${workflowNote}`, data: { id: client.id } };
}

export async function updateClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const raw = formObject(fd);
  const id = z.string().min(1).max(40).safeParse(raw.id);
  const c = clientSchema.safeParse(raw);
  if (!id.success) return { values: echoValues(fd), error: "Nedostaje klijent" };
  if (!c.success) return { values: echoValues(fd), fieldErrors: zodErrors(c.error) };
  const phone = toE164(c.data.phone, defaultCountryCode(ctx.org.timezone));
  if (!phone) return { values: echoValues(fd), fieldErrors: { phone: "Upišite ispravan broj mobitela" } };
  const [dupe] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.org.id), eq(clients.phone, phone)))
    .limit(1);
  if (dupe && dupe.id !== id.data) return { values: echoValues(fd), fieldErrors: { phone: "Drugi klijent već ima ovaj broj" } };
  const [row] = await db
    .update(clients)
    .set({ firstName: c.data.firstName, lastName: c.data.lastName, phone, email: c.data.email || null, notes: c.data.notes || null })
    .where(and(eq(clients.id, id.data), eq(clients.organizationId, ctx.org.id)))
    .returning({ id: clients.id });
  if (!row) return { values: echoValues(fd), error: "Klijent nije pronađen" };
  revalidatePath(`/recenzije/klijenti/${id.data}`);
  revalidatePath("/recenzije/klijenti");
  return { ok: true, message: "Klijent ažuriran" };
}

export async function deleteClientAction(id: string) {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return;
  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.organizationId, ctx.org.id)));
  revalidatePath("/recenzije/klijenti");
  redirect("/recenzije/klijenti");
}

export async function addServiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const raw = formObject(fd);
  const s = serviceSchema.extend({ clientId: z.string().min(1).max(40), service: z.string().trim().min(1, "Upišite uslugu").max(80) }).safeParse(raw);
  if (!s.success) return { values: echoValues(fd), fieldErrors: zodErrors(s.error) };
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, s.data.clientId), eq(clients.organizationId, ctx.org.id)))
    .limit(1);
  if (!client) return { values: echoValues(fd), error: "Klijent nije pronađen" };
  const serviceDate = parseDate(s.data.serviceDate);
  if (!serviceDate) return { values: echoValues(fd), fieldErrors: { serviceDate: "Upišite ispravan datum" } };
  const [svc] = await db
    .insert(services)
    .values({ organizationId: ctx.org.id, clientId: client.id, name: s.data.service, technician: s.data.technician || null, serviceDate })
    .returning();
  let note = "";
  if (s.data.completed === "on") {
    const runs = await completeService(ctx.org.id, client.id, svc.id, fullName(client), svc.name);
    note = runs.length ? " Automatizacija je pokrenuta." : " Nijedna uključena automatizacija ne koristi okidač „završena usluga”.";
  }
  revalidatePath(`/recenzije/klijenti/${client.id}`);
  return { ok: true, message: `Usluga dodana.${note}` };
}

export async function completeServiceAction(serviceId: string): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const [row] = await db
    .select({ s: services, c: clients })
    .from(services)
    .innerJoin(clients, eq(clients.id, services.clientId))
    .where(and(eq(services.id, serviceId), eq(services.organizationId, ctx.org.id)))
    .limit(1);
  if (!row) return { error: "Usluga nije pronađena" };
  if (row.s.completedAt) return { error: "Ova usluga je već završena" };
  const runs = await completeService(ctx.org.id, row.c.id, row.s.id, fullName(row.c), row.s.name);
  revalidatePath(`/recenzije/klijenti/${row.c.id}`);
  revalidatePath("/recenzije/pregled");
  return {
    ok: true,
    message: runs.length ? "Označeno završenim. Automatizacija je pokrenuta." : "Označeno završenim. Nijedna uključena automatizacija ne koristi ovaj okidač.",
  };
}

async function defaultRequestTemplate(orgId: string) {
  const [t] = await db
    .select()
    .from(messageTemplates)
    .where(and(eq(messageTemplates.organizationId, orgId), eq(messageTemplates.kind, "REVIEW_REQUEST")))
    .orderBy(desc(messageTemplates.updatedAt))
    .limit(1);
  return t?.body ?? DEFAULT_REQUEST;
}

function outcomeState(out: SendOutcome, okMsg: string): ActionState {
  return out.ok ? { ok: true, message: okMsg } : { error: out.error, data: { code: out.code } };
}

export async function sendReviewRequestAction(clientId: string, template?: string): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const rl = rateLimit(`send:${ctx.org.id}`, 60, 60_000);
  if (!rl.ok) return { error: "Previše poruka odjednom. Pričekajte minutu pa pokušajte ponovno." };
  const body = template?.trim() ? template.slice(0, 1000) : await defaultRequestTemplate(ctx.org.id);
  const out = await sendClientMessage({ organizationId: ctx.org.id, clientId, template: body, kind: "REVIEW_REQUEST" });
  revalidatePath(`/recenzije/klijenti/${clientId}`);
  revalidatePath("/recenzije/klijenti");
  revalidatePath("/recenzije/pregled");
  return outcomeState(out, "Zahtjev za recenziju poslan");
}

export async function sendBulkRequestsAction(ids: string[]): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const clean = z.array(z.string().min(1).max(40)).max(200).safeParse(ids);
  if (!clean.success || clean.data.length === 0) return { error: "Odaberite barem jednog klijenta" };
  const rl = rateLimit(`send:${ctx.org.id}`, 60, 60_000);
  if (!rl.ok) return { error: "Previše poruka odjednom. Pričekajte minutu pa pokušajte ponovno." };
  const template = await defaultRequestTemplate(ctx.org.id);
  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.org.id), inArray(clients.id, clean.data)));
  let sent = 0;
  let firstError = "";
  for (const r of rows) {
    const out = await sendClientMessage({ organizationId: ctx.org.id, clientId: r.id, template, kind: "REVIEW_REQUEST" });
    if (out.ok) sent++;
    else if (!firstError) firstError = out.error;
    // Stop early on account-level problems; every other client would fail the same way.
    if (!out.ok && ["NOT_CONFIGURED", "NO_REVIEW_URL", "DEMO", "LIMIT"].includes(out.code)) break;
  }
  revalidatePath("/recenzije/klijenti");
  revalidatePath("/recenzije/pregled");
  if (sent === 0) return { error: firstError || "Nijedna poruka nije poslana" };
  return { ok: true, message: `Poslano ${sent} od ${rows.length} zahtjeva${firstError ? `. Neki nisu uspjeli: ${firstError}` : ""}` };
}

export async function markReviewedAction(clientId: string): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const [c] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.org.id)))
    .limit(1);
  if (!c) return { error: "Klijent nije pronađen" };
  await markReviewReceived(ctx.org.id, clientId, null, "MANUAL", new Date());
  revalidatePath(`/recenzije/klijenti/${clientId}`);
  revalidatePath("/recenzije/klijenti");
  return { ok: true, message: "Označeno kao recenzirano. Zakazani podsjetnici su otkazani." };
}

export async function setClientStatusAction(clientId: string, status: "COMPLETED" | "NOT_CONTACTED"): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const [row] = await db
    .update(clients)
    .set({ reviewStatus: status, nextFollowUpAt: null })
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.org.id)))
    .returning();
  if (!row) return { error: "Klijent nije pronađen" };
  if (status === "COMPLETED") await cancelActiveRunsForClient(ctx.org.id, clientId, "Označeno završenim");
  revalidatePath(`/recenzije/klijenti/${clientId}`);
  return { ok: true, message: status === "COMPLETED" ? "Označeno završenim" : "Status vraćen" };
}

export async function toggleOptOutAction(clientId: string, optOut: boolean): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  const [row] = await db
    .update(clients)
    .set({ smsOptOut: optOut })
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.org.id)))
    .returning();
  if (!row) return { error: "Klijent nije pronađen" };
  if (optOut) await cancelActiveRunsForClient(ctx.org.id, clientId, "Klijent se odjavio");
  revalidatePath(`/recenzije/klijenti/${clientId}`);
  return { ok: true, message: optOut ? "SMS je isključen za ovog klijenta" : "SMS je ponovno uključen" };
}
