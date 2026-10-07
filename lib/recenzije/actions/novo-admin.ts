"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentAdminRecord } from "@/lib/auth";
import { logActivity } from "@/lib/db/queries";
import { type ActionState, echoValues, formObject, zodErrors } from "@/lib/recenzije/action";
import { createInviteCode, InviteError, revokeInviteCode } from "@/lib/recenzije/services/invites";
import { activatePlanManually, deactivate, extendTrial } from "@/lib/recenzije/services/novo-admin";

/**
 * Radnje s /admin/recenzije. Smije ih samo glavni admin NOVO-a (isti uvjet
 * kao Financije), jer mijenjaju naplatu tvrtki koje koriste Recenzije.
 */
async function requireSuperAdmin() {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (!admin.isSuperAdmin) redirect("/admin");
  return admin;
}

async function run(fn: () => Promise<string>, adminEmail: string, action: string) {
  let target = "/admin/recenzije";
  try {
    const label = await fn();
    await logActivity({ adminEmail, action, targetLabel: label, propertyId: null }).catch(() => undefined);
    target += `?ok=${encodeURIComponent(label)}`;
  } catch (e) {
    target += `?greska=${encodeURIComponent(e instanceof Error ? e.message : "Nije uspjelo.")}`;
  }
  revalidatePath("/admin/recenzije");
  revalidatePath("/recenzije", "layout");
  redirect(target);
}

export async function activatePlanAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  const planKey = String(formData.get("planKey") ?? "");
  const months = Number(formData.get("months") ?? 1) || 1;
  await run(() => activatePlanManually(orgId, planKey, months), admin.email, "Recenzije: aktiviran paket");
}

export async function extendTrialAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  const days = Number(formData.get("days") ?? 14) || 14;
  await run(() => extendTrial(orgId, days), admin.email, "Recenzije: produžena proba");
}

export async function deactivateAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  await run(() => deactivate(orgId), admin.email, "Recenzije: ugašena pretplata");
}

/** Prazno polje je "nije zadano"; inače cijeli broj u rasponu. */
function optionalInt(min: number, max: number, message: string) {
  return z
    .string()
    .default("")
    .transform((v) => (v.trim() === "" ? undefined : Number(v)))
    .pipe(z.number(message).int(message).min(min, message).max(max, message).optional());
}

const createInviteSchema = z.object({
  label: z.string().trim().max(80, "Najviše 80 znakova").default(""),
  maxUses: optionalInt(1, 1000, "Upišite broj od 1 do 1000"),
  expiresInDays: optionalInt(1, 365, "Upišite broj dana od 1 do 365"),
});

/** Novi pozivni kod. Kod se vraća u `data.code` da ga forma odmah prikaže i ponudi za kopiranje. */
export async function createInviteCodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const parsed = createInviteSchema.safeParse(formObject(fd));
  // values: React nakon akcije resetira formu, pa vraćamo upisano da se ne izgubi pri grešci.
  if (!parsed.success) return { fieldErrors: zodErrors(parsed.error), values: echoValues(fd) };
  const { label, maxUses, expiresInDays } = parsed.data;
  try {
    const row = await createInviteCode({
      label: label || null,
      maxUses: maxUses ?? 1,
      expiresInDays: expiresInDays ?? null,
      createdBy: admin.email,
    });
    // U dnevnik ide samo oznaka, ne i sam kod: dnevnik vide i admini koji nisu glavni.
    await logActivity({
      adminEmail: admin.email,
      action: "Recenzije: novi pozivni kod",
      targetLabel: `${row.label ?? "bez oznake"} (${row.maxUses}x)`,
      propertyId: null,
    }).catch(() => undefined);
    revalidatePath("/admin/recenzije");
    return { ok: true, message: "Pozivni kod je napravljen.", data: { code: row.code } };
  } catch (e) {
    if (!(e instanceof InviteError)) console.error("[recenzije] novi pozivni kod", e);
    return { error: e instanceof InviteError ? e.message : "Kod nije napravljen. Pokušajte ponovno.", values: echoValues(fd) };
  }
}

export async function revokeInviteCodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const parsed = z.object({ id: z.string().trim().min(1).max(40) }).safeParse(formObject(fd));
  if (!parsed.success) return { error: "Kod nije pronađen." };
  try {
    const row = await revokeInviteCode(parsed.data.id);
    await logActivity({
      adminEmail: admin.email,
      action: "Recenzije: opozvan pozivni kod",
      targetLabel: row.label ?? "bez oznake",
      propertyId: null,
    }).catch(() => undefined);
    revalidatePath("/admin/recenzije");
    return { ok: true, message: "Kod je opozvan." };
  } catch (e) {
    if (!(e instanceof InviteError)) console.error("[recenzije] opoziv pozivnog koda", e);
    revalidatePath("/admin/recenzije");
    return { error: e instanceof InviteError ? e.message : "Kod nije opozvan. Pokušajte ponovno." };
  }
}
