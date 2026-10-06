"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { organizations, users } from "@/lib/recenzije/db/schema";
import { type ActionState, echoValues, formObject, zodErrors } from "@/lib/recenzije/action";
import { toE164 } from "@/lib/recenzije/phone";
import { ACTIVE_ORG_COOKIE, DEMO_LOCKED, assertMember, requireRole, requireUser, requireWritableOrg } from "@/lib/recenzije/session";
import { DEMO_EMAIL } from "@/lib/recenzije/db/seed";
import { GOOGLE_REVIEW_URL_HINT, GOOGLE_REVIEW_URL_RE } from "@/lib/recenzije/validation";

const reviewUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || GOOGLE_REVIEW_URL_RE.test(v),
    GOOGLE_REVIEW_URL_HINT
  );

const orgSchema = z.object({
  name: z.string().trim().min(2, "Upišite naziv tvrtke").max(80),
  industry: z.string().trim().max(60).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  googleReviewUrl: reviewUrl.optional().default(""),
  timezone: z.string().trim().max(60).optional().default("Europe/Zagreb"),
});

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

/**
 * NOVO Recenzije vodi NOVO: tvrtke otvara glavni admin u /admin/recenzije,
 * pa korisnici više ne mogu sami otvarati tvrtke (ni beskonačne probe).
 */
export async function createOrganizationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  return { values: echoValues(fd), error: "Tvrtke otvara NOVO. Javite nam se na /recenzije i sve postavimo za vas." };
}

export async function switchOrganizationAction(orgId: string) {
  const user = await requireUser();
  if (!(await assertMember(user.id, orgId))) return;
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, cookieOpts);
  redirect("/recenzije/pregled");
}

export async function updateBusinessAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return locked;
  try {
    requireRole(ctx, ["OWNER", "ADMIN"]);
  } catch (e) {
    return { values: echoValues(fd), error: (e as Error).message };
  }
  const raw = formObject(fd);
  const parsed = orgSchema
    .extend({ googlePlaceId: z.string().trim().max(200).optional().default("") })
    .safeParse(raw);
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };
  const d = parsed.data;
  const phone = d.phone ? toE164(d.phone) : null;
  if (d.phone && !phone) return { values: echoValues(fd), fieldErrors: { phone: "Upišite ispravan broj telefona" } };
  let googleReviewUrl = d.googleReviewUrl || null;
  if (!googleReviewUrl && d.googlePlaceId) {
    googleReviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(d.googlePlaceId)}`;
  }
  await db
    .update(organizations)
    .set({
      name: d.name,
      industry: d.industry || null,
      phone,
      timezone: d.timezone || "Europe/Zagreb",
      googleReviewUrl,
      googlePlaceId: d.googlePlaceId || null,
    })
    .where(eq(organizations.id, ctx.org.id));
  revalidatePath("/recenzije", "layout");
  return { ok: true, message: "Profil tvrtke spremljen" };
}

export async function updateAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.email === DEMO_EMAIL) return DEMO_LOCKED;
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Upišite ime i prezime").max(80),
      currentPassword: z.string().max(200).optional().default(""),
      newPassword: z.string().max(200).optional().default(""),
    })
    .safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };
  const d = parsed.data;
  const update: { name: string; passwordHash?: string } = { name: d.name };
  if (d.newPassword && user.email.endsWith("@novo.invalid")) {
    return { values: echoValues(fd), fieldErrors: { newPassword: "Operaterski račun NOVO-a ulazi preko NOVO admina i nema lozinku." } };
  }
  if (d.newPassword) {
    if (d.newPassword.length < 8 || !/\d/.test(d.newPassword)) {
      return { values: echoValues(fd), fieldErrors: { newPassword: "Najmanje 8 znakova i barem jedan broj" } };
    }
    if (user.passwordHash) {
      const ok = await bcrypt.compare(d.currentPassword, user.passwordHash);
      if (!ok) return { values: echoValues(fd), fieldErrors: { currentPassword: "Trenutna lozinka nije točna" } };
    }
    update.passwordHash = await bcrypt.hash(d.newPassword, 12);
  }
  await db.update(users).set(update).where(eq(users.id, user.id));
  revalidatePath("/recenzije", "layout");
  return { ok: true, message: d.newPassword ? "Račun i lozinka ažurirani" : "Račun ažuriran" };
}
