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
  "admin", "api", "login", "logout", "robots.txt", "sitemap.xml", "favicon.ico", "_next", "en", "nfc", "proizvodi", "jelovnik",
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
  await logActivity({ adminEmail: admin.email, action: "accepted_invite", targetLabel: admin.email, propertyId: null });

  if (admin.twoFactorEnabled) {
    // 2FA ostaje uključena — prijava ide normalnim putem s kodom.
    redirect("/admin/login?lozinka=postavljena");
  }
  await setSessionCookie(await createSessionToken({ adminId: admin.id, email: admin.email }));
  redirect("/admin");
}

/* ---------------------------------------------------------------- */
/* Uređivanje admina i vlasnika (plan #14)                           */
/* ---------------------------------------------------------------- */

const EditAdminSchema = z.object({
  role: z.enum(["admin", "owner"]),
  displayName: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(80).optional(),
  propertyIds: z.array(z.coerce.number().int()).default([]),
  companyIds: z.array(z.coerce.number().int()).default([]),
});

export async function updateAdminAccountAction(adminId: number, _prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const me = await requireSuper();
  const target = await getAdminById(adminId);
  if (!target) return { error: "Račun više ne postoji." };
  const parsed = EditAdminSchema.safeParse({
    role: formData.get("role"),
    displayName: formData.get("displayName") || undefined,
    jobTitle: formData.get("jobTitle") || undefined,
    propertyIds: formData.getAll("propertyIds"),
    companyIds: formData.getAll("companyIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  const d = parsed.data;
  if (target.isSuperAdmin && d.role !== "admin") return { error: "Glavni admin ne može postati vlasnik." };
  if (d.role === "owner" && d.propertyIds.length === 0 && d.companyIds.length === 0) {
    return { error: "Vlasnik mora imati barem jednu vikendicu ili firmu." };
  }
  await updateAdminAccount(adminId, { role: d.role, displayName: d.displayName || null, jobTitle: d.jobTitle || null });
  if (d.role === "owner") await setAdminAccess(adminId, { propertyIds: d.propertyIds, companyIds: d.companyIds });
  await logActivity({ adminEmail: me.email, action: "updated_admin", targetLabel: target.email, propertyId: null });
  revalidatePath("/admin/admins");
  revalidatePath(`/admin/admins/${adminId}`);
  return { success: true };
}

/** Isključuje 2FA drugome (npr. izgubio mobitel) — sljedeća prijava je samo lozinkom. */
export async function resetAdminTwoFactorAction(adminId: number) {
  const me = await requireSuper();
  const target = await getAdminById(adminId);
  if (!target || target.id === me.id) redirect(`/admin/admins/${adminId}`);
  await disableTwoFactor(adminId);
  await logActivity({ adminEmail: me.email, action: "reset_2fa", targetLabel: target.email, propertyId: null });
  revalidatePath(`/admin/admins/${adminId}`);
  redirect(`/admin/admins/${adminId}?spremljeno=2fa`);
}

/* ---------------------------------------------------------------- */
/* Evidencija uplata (plan #17)                                      */
/* ---------------------------------------------------------------- */

const PaymentSchema = z.object({
  amountEur: z.coerce.number().int({ message: "Iznos mora biti cijeli broj eura." }).min(1, { message: "Upiši iznos." }),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Odaberi datum uplate." }),
  months: z.coerce.number().int().min(1).max(24).default(1),
  method: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function recordPaymentAction(subscriptionId: number, _prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const me = await requireSuper();
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return { error: "Pretplata više ne postoji." };
  const parsed = PaymentSchema.safeParse({
    amountEur: formData.get("amountEur"),
    paidOn: formData.get("paidOn"),
    months: formData.get("months") || 1,
    method: formData.get("method") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provjeri podatke uplate." };
  await recordSubscriptionPayment({
    subscriptionId,
    amountEur: parsed.data.amountEur,
    paidOn: parsed.data.paidOn,
    months: parsed.data.months,
    method: parsed.data.method || null,
    note: parsed.data.note || null,
    recordedBy: me.email,
  });
  await logActivity({
    adminEmail: me.email,
    action: "recorded_payment",
    targetLabel: `${sub.sourceName} — ${parsed.data.amountEur} €`,
    propertyId: sub.source === "property" ? sub.sourceId : null,
  });
  revalidatePath("/admin/financije");
  revalidatePath(`/admin/financije/${subscriptionId}`);
  revalidatePath("/admin");
  return { success: true };
}

/** Brza uplata iz tablice: jedan mjesec po trenutnoj cijeni, plaćeno danas. */
export async function quickPaymentAction(subscriptionId: number) {
  const me = await requireSuper();
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return;
  await recordSubscriptionPayment({
    subscriptionId,
    amountEur: sub.monthlyPriceEur,
    paidOn: todayDateStringZagreb(),
    months: 1,
    method: null,
    note: null,
    recordedBy: me.email,
  });
  await logActivity({
    adminEmail: me.email,
    action: "recorded_payment",
    targetLabel: `${sub.sourceName} — ${sub.monthlyPriceEur} €`,
    propertyId: sub.source === "property" ? sub.sourceId : null,
  });
  revalidatePath("/admin/financije");
  revalidatePath("/admin");
}

export async function deletePaymentAction(paymentId: number) {
  await requireSuper();
  const subId = await deleteSubscriptionPayment(paymentId);
  revalidatePath("/admin/financije");
  if (subId) revalidatePath(`/admin/financije/${subId}`);
}

/* ---------------------------------------------------------------- */
/* Čarobnjak za novog klijenta (plan #12)                            */
/* ---------------------------------------------------------------- */

const WizardSchema = z
  .object({
    kind: z.enum(["property", "company"]),
    name: z.string().trim().min(2, { message: "Upiši naziv klijenta." }).max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{2,60}$/, { message: "Adresa smije imati samo mala slova, brojeve i crtice." }),
    location: z.string().trim().max(120).default(""),
    priceFromEur: z.coerce.number().int().min(0).default(0),
    capacityGuests: z.coerce.number().int().min(1).default(2),
    bedrooms: z.coerce.number().int().min(0).default(1),
    monthlyPriceEur: z.coerce.number().int().min(0).default(0),
    trialDays: z.coerce.number().int().min(0).max(120).default(0),
    ownerEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email({ message: "E-mail vlasnika nije ispravan." })]).default(""),
    ownerName: z.string().trim().max(80).default(""),
  });

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

/**
 * Jedan korak umjesto tri stranice: stvori (neobjavljenu) vikendicu ili
 * firmu, pretplatu i vlasnika s pozivnicom. Stranica ostaje skrivena dok je
 * ne popuniš i objaviš — čarobnjak samo postavi kostur.
 */
export async function createClientWizardAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await requireSuper();
  const parsed = WizardSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  const d = parsed.data;
  if (RESERVED_SLUGS.has(d.slug)) return { error: `"${d.slug}" je rezervirana adresa, odaberi drugu.` };
  if (await isSlugTaken(d.slug)) return { error: `Adresa "${d.slug}" je već zauzeta — odaberi drugu.` };
  if (d.ownerEmail && (await findAdminByEmail(d.ownerEmail))) {
    return { error: "Vlasnik s tim e-mailom već ima račun — dodaj mu ovu stranicu u Admini → Uredi." };
  }

  let sourceId: number;
  let editHref: string;
  if (d.kind === "property") {
    const p = await createProperty({
      slug: d.slug,
      name: d.name,
      location: d.location,
      tagline: "",
      description: "",
      priceFromEur: d.priceFromEur,
      capacityGuests: d.capacityGuests,
      bedrooms: d.bedrooms,
      distanceFromCenter: "",
      published: false,
    });
    sourceId = p.id;
    editHref = `/admin/properties/${p.id}`;
  } else {
    const c = await createCompany({ slug: d.slug, name: d.name, location: d.location, tagline: "", description: "", published: false });
    sourceId = c.id;
    editHref = `/admin/companies/${c.id}`;
  }

  if (d.monthlyPriceEur > 0) {
    const today = todayDateStringZagreb();
    const isTrial = d.trialDays > 0;
    const trialEndsAt = isTrial ? addDays(today, d.trialDays) : null;
    await createSubscription({
      source: d.kind,
      sourceId,
      sourceName: d.name,
      monthlyPriceEur: d.monthlyPriceEur,
      startDate: today,
      isTrial,
      trialEndsAt,
      status: isTrial ? "trial" : "active",
      nextRenewalDate: trialEndsAt ?? addMonths(today, 1),
      note: null,
    });
  }

  let link: string | undefined;
  let emailed: boolean | undefined;
  if (d.ownerEmail) {
    const owner = await createAdmin({
      email: d.ownerEmail,
      passwordHash: await bcrypt.hash(randomBytes(24).toString("base64url"), 12),
      isSuperAdmin: false,
      role: "owner",
    });
    if (d.ownerName) await updateAdminAccount(owner.id, { role: "owner", displayName: d.ownerName, jobTitle: null });
    await setAdminAccess(owner.id, {
      propertyIds: d.kind === "property" ? [sourceId] : [],
      companyIds: d.kind === "company" ? [sourceId] : [],
    });
    ({ link, emailed } = await issueInvite(owner, me, { isReset: false, scopeLabel: d.name }));
  }

  await logActivity({
    adminEmail: me.email,
    action: "created_client",
    targetLabel: d.name,
    propertyId: d.kind === "property" ? sourceId : null,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/vikendice");
  revalidatePath("/admin/financije");
  revalidatePath("/admin/admins");
  return { success: true, link, emailed, email: d.ownerEmail || undefined, nextHref: editHref };
}
