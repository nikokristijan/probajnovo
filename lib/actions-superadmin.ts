"use server";

/**
 * Faza 2 — superadmin akcije (plan #12, #13, #14, #17, #21): pozivnice
 * e-mailom, uređivanje admina/vlasnika, evidencija uplata i čarobnjak za
 * novog klijenta. Odvojeno od lib/actions.ts da taj (već ogroman) modul ne
 * raste dalje; ista pravila pristupa (samo glavni admin, osim prihvaćanja
 * pozivnice koje je javno — token je sam dokaz).
 */

import { createHash, randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSessionToken, setSessionCookie, getCurrentAdminRecord } from "@/lib/auth";
import {
  findAdminByEmail,
  getAdminById,
  createAdmin,
  setAdminAccess,
  getAdminAccessGrants,
  updateAdminAccount,
  disableTwoFactor,
  setAdminInvite,
  findAdminByInviteHash,
  acceptAdminInvite,
  clearFailedLogins,
  getSubscriptionById,
  recordSubscriptionPayment,
  deleteSubscriptionPayment,
  createSubscription,
  createProperty,
  createCompany,
  isSlugTaken,
  logActivity,
  listProperties,
  listCompanies,
} from "@/lib/db/queries";
import { sendAdminInvite } from "@/lib/email";
import { todayDateStringZagreb } from "@/lib/date";
import type { AdminUser } from "@/lib/db/schema";

export type InviteState =
  | {
      error?: string;
      success?: boolean;
      /** Link za kopiranje (npr. za WhatsApp) — prikazuje se samo superadminu. */
      link?: string;
      emailed?: boolean;
      email?: string;
      /** Za čarobnjak: kamo dalje (uređivanje nove stranice). */
      nextHref?: string;
    }
  | undefined;

export type SimpleState = { error?: string; success?: boolean } | undefined;

const RESERVED_SLUGS = new Set([
  "admin", "api", "login", "logout", "robots.txt", "sitemap.xml", "favicon.ico", "_next", "en", "nfc", "proizvodi",
]);

async function requireSuper(): Promise<AdminUser> {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");
  if (me.role === "owner" || !me.isSuperAdmin) redirect("/admin");
  return me;
}

function nameOf(a: Pick<AdminUser, "displayName" | "email">): string {
  return a.displayName?.trim() || a.email.split("@")[0];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function originFromRequest(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.probajnovo.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Izda novi jednokratni link (stari prestaje vrijediti) i pokuša poslati e-mail. */
async function issueInvite(
  target: Pick<AdminUser, "id" | "email" | "role">,
  inviter: AdminUser,
  opts: { isReset: boolean; scopeLabel?: string | null }
): Promise<{ link: string; emailed: boolean }> {
  const token = randomBytes(32).toString("base64url");
  await setAdminInvite(target.id, hashToken(token));
  const link = `${await originFromRequest()}/admin/pozivnica/${token}`;
  const emailed = await sendAdminInvite({
    to: target.email,
    link,
    role: target.role === "owner" ? "owner" : "admin",
    inviterName: nameOf(inviter),
    scopeLabel: opts.scopeLabel,
    isReset: opts.isReset,
  });
  return { link, emailed };
}

async function scopeLabelFor(adminId: number): Promise<string | null> {
  const [grants, props, comps] = await Promise.all([getAdminAccessGrants(adminId), listProperties(), listCompanies()]);
  const names = grants
    .map((g) =>
      g.propertyId != null
        ? props.find((p) => p.id === g.propertyId)?.name
        : comps.find((c) => c.id === g.companyId)?.name
    )
    .filter((n): n is string => !!n);
  return names.length ? names.join(", ") : null;
}

/* ---------------------------------------------------------------- */
/* Pozivnica (plan #13)                                              */
/* ---------------------------------------------------------------- */

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Unesi ispravan e-mail." }),
  role: z.enum(["admin", "owner"]).default("admin"),
  displayName: z.string().trim().max(80).optional(),
  propertyIds: z.array(z.coerce.number().int()).default([]),
  companyIds: z.array(z.coerce.number().int()).default([]),
});

export async function inviteAdminAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await requireSuper();
  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") || "admin",
    displayName: formData.get("displayName") || undefined,
    propertyIds: formData.getAll("propertyIds"),
    companyIds: formData.getAll("companyIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  const d = parsed.data;
  if (d.role === "owner" && d.propertyIds.length === 0 && d.companyIds.length === 0) {
    return { error: "Odaberi barem jednu vikendicu ili firmu koju vlasnik smije vidjeti." };
  }
  if (await findAdminByEmail(d.email)) return { error: "Već postoji račun s tim e-mailom." };

  // Nasumična lozinka koju nitko ne zna — račun je neupotrebljiv dok osoba
  // ne postavi svoju preko linka.
  const created = await createAdmin({
    email: d.email,
    passwordHash: await bcrypt.hash(randomBytes(24).toString("base64url"), 12),
    isSuperAdmin: false,
    role: d.role,
  });
  if (d.displayName) await updateAdminAccount(created.id, { role: d.role, displayName: d.displayName, jobTitle: null });
  if (d.role === "owner") await setAdminAccess(created.id, { propertyIds: d.propertyIds, companyIds: d.companyIds });

  const scope = d.role === "owner" ? await scopeLabelFor(created.id) : null;
  const { link, emailed } = await issueInvite(created, me, { isReset: false, scopeLabel: scope });
  await logActivity({ adminEmail: me.email, action: "invited_admin", targetLabel: d.email, propertyId: null });
  revalidatePath("/admin/admins");
  return { success: true, link, emailed, email: d.email };
}

/** Nova pozivnica / link za novu lozinku za postojeći račun. */
export async function resendInviteAction(adminId: number): Promise<InviteState> {
  const me = await requireSuper();
  const target = await getAdminById(adminId);
  if (!target) return { error: "Račun više ne postoji." };
  const scope = target.role === "owner" ? await scopeLabelFor(target.id) : null;
  // Ako je osoba već jednom postavila lozinku, ovo je reset; inače ponovljena pozivnica.
  const { link, emailed } = await issueInvite(target, me, { isReset: true, scopeLabel: scope });
  await logActivity({ adminEmail: me.email, action: "sent_password_link", targetLabel: target.email, propertyId: null });
  revalidatePath("/admin/admins");
  revalidatePath(`/admin/admins/${adminId}`);
  return { success: true, link, emailed, email: target.email };
}

const AcceptSchema = z
  .object({
    password: z.string().min(8, { message: "Lozinka mora imati barem 8 znakova." }),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Lozinke se ne podudaraju.", path: ["confirm"] });

/** Javno: osoba s linkom postavlja lozinku i odmah ulazi. */
export async function acceptInviteAction(token: string, _prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const parsed = AcceptSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provjeri lozinku." };
  const admin = await findAdminByInviteHash(hashToken(token));
  if (!admin) return { error: "Link je istekao ili je već iskorišten. Zatraži novi od administratora." };

  await acceptAdminInvite(admin.id, await bcrypt.hash(parsed.data.password, 12));
  await clearFailedLogins(admin.id);
