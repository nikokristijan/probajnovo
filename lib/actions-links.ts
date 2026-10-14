"use server";

/**
 * Dinamički NFC linkovi (privjesci) — vidi nfcLinks u lib/db/schema.ts i
 * app/admin/linkovi. Pristup: puni admini (isti kao NFC oznake).
 */

import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAdminRecord } from "@/lib/auth";
import { logActivity } from "@/lib/db/queries";
import { createNfcLink, getNfcLinkById, isNfcLinkCodeTaken, updateNfcLink } from "@/lib/db/links";
import { NFC_LINK_CODE_RE } from "@/lib/linkHost";
import type { ActionState } from "@/lib/actions";

async function requireFullAdmin() {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (admin.role === "owner") redirect("/admin/inquiries");
  return admin;
}

/** Bez znakova koji se lako pobrkaju (0/o, 1/l/i). */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function randomCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

const TargetUrl = z
  .string()
  .trim()
  .min(1, "Upiši odredište.")
  .transform((v) => (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`))
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Odredište mora biti ispravna web adresa (npr. https://primjer.hr/rezervacije).");

const CreateSchema = z.object({
  label: z.string().trim().min(1, "Upiši interni naziv (npr. „Padel klub — serija 1“).").max(120),
  targetUrl: TargetUrl,
  code: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .refine((v) => !v || NFC_LINK_CODE_RE.test(v), "Kod: 3–32 znaka, mala slova, brojke i crtice."),
});

export async function createNfcLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireFullAdmin();
  const parsed = CreateSchema.safeParse({
    label: formData.get("label") ?? "",
    targetUrl: formData.get("targetUrl") ?? "",
    code: (formData.get("code") as string | null) || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };

  let code = parsed.data.code;
  if (code) {
    if (await isNfcLinkCodeTaken(code)) return { error: `Kod „${code}“ je već zauzet — odaberi drugi ili ostavi prazno.` };
  } else {
    for (let i = 0; i < 8 && !code; i++) {
      const c = randomCode();
      if (!(await isNfcLinkCodeTaken(c))) code = c;
    }
    if (!code) return { error: "Nije uspjelo napraviti kod, pokušaj ponovno." };
  }

  await createNfcLink({ code, label: parsed.data.label, targetUrl: parsed.data.targetUrl });
  await logActivity({ adminEmail: admin.email, action: "created_nfc_link", targetLabel: `${parsed.data.label} → ${parsed.data.targetUrl}`, propertyId: null }).catch(() => undefined);
  revalidatePath("/admin/linkovi");
  return { success: true };
}

export async function updateNfcLinkTargetAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireFullAdmin();
  const link = await getNfcLinkById(id);
  if (!link) return { error: "Link više ne postoji." };
  const parsed = TargetUrl.safeParse(formData.get("targetUrl") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Neispravna adresa." };
  const label = String(formData.get("label") ?? "").trim() || link.label;
  if (parsed.data === link.targetUrl && label === link.label) return { success: true };
  await updateNfcLink(id, {
    label,
    targetUrl: parsed.data,
    previousUrl: parsed.data === link.targetUrl ? link.previousUrl : link.targetUrl,
  });
  if (parsed.data !== link.targetUrl) {
    await logActivity({ adminEmail: admin.email, action: "changed_nfc_link", targetLabel: `${label}: ${link.targetUrl} → ${parsed.data}`, propertyId: null }).catch(() => undefined);
  }
  revalidatePath("/admin/linkovi");
  return { success: true };
}

export async function restorePreviousNfcLinkAction(id: number) {
  const admin = await requireFullAdmin();
  const link = await getNfcLinkById(id);
  if (!link?.previousUrl) return;
  await updateNfcLink(id, { targetUrl: link.previousUrl, previousUrl: link.targetUrl });
  await logActivity({ adminEmail: admin.email, action: "changed_nfc_link", targetLabel: `${link.label}: ${link.targetUrl} → ${link.previousUrl}`, propertyId: null }).catch(() => undefined);
  revalidatePath("/admin/linkovi");
}

export async function setNfcLinkActiveAction(id: number, active: boolean) {
  await requireFullAdmin();
  await updateNfcLink(id, { active });
  revalidatePath("/admin/linkovi");
}
