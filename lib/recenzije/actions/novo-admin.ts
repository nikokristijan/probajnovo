"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { logActivity } from "@/lib/db/queries";
import { createSession } from "@/lib/recenzije/auth";
import { ACTIVE_ORG_COOKIE } from "@/lib/recenzije/session";
import {
  activatePlanManually,
  createBusinessForNovo,
  deactivate,
  ensureOperatorMembership,
  ensureOperatorUser,
  extendTrial,
} from "@/lib/recenzije/services/novo-admin";

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

/** Otvara novu tvrtku (NOVO vodi uslugu, tvrtke se ne registriraju same). */
export async function createBusinessAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const operatorId = await ensureOperatorUser(admin.id, admin.displayName ?? admin.email);
  await run(
    async () =>
      (
        await createBusinessForNovo(operatorId, {
          name: String(formData.get("name") ?? ""),
          industry: String(formData.get("industry") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          googleReviewUrl: String(formData.get("googleReviewUrl") ?? ""),
          planKey: String(formData.get("planKey") ?? "trial"),
          months: Number(formData.get("months") ?? 1) || 1,
        })
      ).label,
    admin.email,
    "Recenzije: nova tvrtka"
  );
}

/**
 * Ulaz u aplikaciju kao operater odabrane tvrtke: glavni admin NOVO-a dobiva
 * prijavu u Recenzije (svoj e-mail, bez lozinke) i članstvo u tvrtki, pa
 * klijente, poruke i postavke vodi izravno iz aplikacije.
 */
export async function openWorkspaceAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  let error: string | null = null;
  try {
    const userId = await ensureOperatorUser(admin.id, admin.displayName ?? admin.email);
    await ensureOperatorMembership(userId, orgId);
    await createSession(userId);
    (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Nije uspjelo.";
  }
  if (error) redirect(`/admin/recenzije?greska=${encodeURIComponent(error)}`);
  redirect("/recenzije/pregled");
}
