"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getCurrentAdmin,
  createPendingTwoFactorToken,
  setPendingTwoFactorCookie,
  clearPendingTwoFactorCookie,
  getPendingTwoFactorAdminId,
} from "@/lib/auth";
import {
  findAdminByEmail,
  getAgency,
  updateAgency,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyById,
  isSlugTaken,
  createStudy,
  updateStudy,
  deleteStudy,
  createProduct,
  updateProduct,
  deleteProduct,
  createInquiry,
  countRecentInquiriesByIp,
  getInquiryById,
  markInquiryRead,
  markInquiryReplied,
  deleteInquiry,
  getAdminById,
  listAdmins,
  createAdmin,
  deleteAdmin,
  countAdmins,
  updateAdminPassword,
  setTwoFactorSecret,
  enableTwoFactor,
  disableTwoFactor,
  hasAdminAccess,
  setAdminAccess,
  addManualBlockedDate,
  removeManualBlockedDate,
  blockManualDateRange,
  createReservation,
  deleteReservation,
  setReservationPaid,
  setReservationDeposit,
  markReservationConfirmationSent,
  createExpense,
  deleteExpense,
  createSale,
  deleteSale,
  SALE_CATEGORIES,
  logActivity,
} from "@/lib/db/queries";
import { sendInquiryNotification, sendGuestConfirmation, sendReservationConfirmation, sendInquiryReply } from "@/lib/email";
import { resolveCoordinates, geoMissWarning } from "@/lib/geocode";
import type { AdminUser, Inquiry } from "@/lib/db/schema";

export type ActionState =
  | { error?: string; success?: boolean; warning?: string }
  | undefined;

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "logout",
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
  "_next",
  "en", // /en/[slug] — auto-prijevod vikendica, vidi app/en/[slug]/page.tsx
]);

/** Postgres 42P01 ("relation does not exist") — kod živi na `.cause` kod Drizzle grešaka, ne na samoj grešci. */
function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ("code" in err && (err as { code?: string }).code === "42P01") return true;
  const cause = (err as { cause?: unknown }).cause;
  return Boolean(cause && typeof cause === "object" && "code" in cause && (cause as { code?: string }).code === "42P01");
}

/* ---------------------------------------------------------------- */
/* Prijava / odjava                                                  */
/* ---------------------------------------------------------------- */

const LoginSchema = z.object({
  email: z.string().email({ message: "Unesi ispravan email." }),
  password: z.string().min(1, { message: "Unesi lozinku." }),
});

/** Zajednička TOTP konfiguracija — MORA biti identična na sva tri mjesta koja
    je koriste (startTwoFactorSetupAction, confirmTwoFactorSetupAction,
    verifyTwoFactorLoginAction), inače kod koji radi u Google Authenticatoru
    ne bi prošao provjeru ovdje. Issuer se prikazuje u autentifikatoru iznad
    koda (npr. "NOVO admin (ana@primjer.hr)"). */
function buildTotp(email: string, secret: Secret) {
  return new TOTP({ issuer: "NOVO admin", label: email, algorithm: "SHA1", digits: 6, period: 30, secret });
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Provjeri email i lozinku." };
  }

  const admin = await findAdminByEmail(parsed.data.email.toLowerCase().trim());
  if (!admin) {
    return { error: "Pogrešan email ili lozinka." };
  }

  const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!valid) {
    return { error: "Pogrešan email ili lozinka." };
  }

  if (admin.twoFactorEnabled) {
    // Lozinka je točna, ali puna sesija se NE stvara dok admin ne potvrdi
    // TOTP kod — vidi verifyTwoFactorLoginAction i lib/auth.ts "pending 2FA".
    const pendingToken = await createPendingTwoFactorToken(admin.id);
    await setPendingTwoFactorCookie(pendingToken);
    redirect("/admin/login/2fa");
  }

  const token = await createSessionToken({ adminId: admin.id, email: admin.email });
  await setSessionCookie(token);
  // Vlasnik (role="owner") nema pristup punom /admin panelu — vidi requireAdmin ispod
  // — ali /admin sad prikazuje njegov vlastiti (ograničen, read-only) dashboard umjesto
  // punog pregleda, pa svi idu na istu adresu nakon prijave (vidi app/admin/page.tsx).
  redirect("/admin");
}

const TwoFactorLoginSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: "Unesi 6-znamenkasti kod iz aplikacije." }),
});

/** Drugi korak prijave kad admin ima 2FA uključen — vidi loginAction gore i
    app/admin/login/2fa. Oslanja se ISKLJUČIVO na "pending 2FA" kolačić za
    identitet (ne na bilo kakav formData admin id) da netko ne može ubaciti
    tuđi adminId i pogoditi kod. */
export async function verifyTwoFactorLoginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const adminId = await getPendingTwoFactorAdminId();
  if (!adminId) redirect("/admin/login");

  const admin = await getAdminById(adminId);
  if (!admin || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
    await clearPendingTwoFactorCookie();
    redirect("/admin/login");
  }

  const parsed = TwoFactorLoginSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Unesi 6-znamenkasti kod." };
  }

  const totp = buildTotp(admin.email, Secret.fromBase32(admin.twoFactorSecret));
  const delta = totp.validate({ token: parsed.data.code, window: 1 });
  if (delta === null) {
    return { error: "Kod nije ispravan ili je istekao." };
  }

  await clearPendingTwoFactorCookie();
  const token = await createSessionToken({ adminId: admin.id, email: admin.email });
  await setSessionCookie(token);
  redirect("/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/admin/login");
}

/** Pročita punu bazu redak trenutnog admina (bilo koje uloge), ili preusmjeri na login. */
async function requireAdminRow(): Promise<AdminUser> {
  const session = await getCurrentAdmin();
  if (!session) redirect("/admin/login");
  const row = await getAdminById(session.adminId);
  if (!row) redirect("/admin/login");
  return row;
}

/** Puni admin (role="admin") — za sve akcije koje UREĐUJU sadržaj (vikendice, firme,
    studies, proizvodi, agencija, admini, brisanje upita). Vlasnik (role="owner") se
    ovdje zaustavlja i vraća na svoj pregled upita — vidi standing rule: vlasnik ne
    smije ništa uređivati, samo gledati upite i kalendar svojih vikendica/firmi. */
async function requireAdmin() {
  const row = await requireAdminRow();
  if (row.role === "owner") redirect("/admin/inquiries");
  return { adminId: row.id, email: row.email };
}

/** Kao requireAdmin, ali dodatno provjeri je li ovaj admin glavni (super admin). */
async function requireSuperAdmin() {
  const row = await requireAdminRow();
  if (row.role === "owner" || !row.isSuperAdmin) {
    redirect("/admin");
  }
  return { adminId: row.id, email: row.email, row };
}

/** Puni admin ILI vlasnik — za akcije dopuštene i vlasniku, ali samo za NJEGOVE
    vikendice/firme (uvijek prati s assertPropertyAccess/assertInquiryAccess
    ispod da vlasnik ne vidi/mijenja tuđe). */
async function requireAdminOrOwner(): Promise<AdminUser> {
  return requireAdminRow();
}

/** Puni admini smiju uvijek; vlasnik samo ako mu je ova vikendica dodijeljena
    (admin_access) — inače ga vraćamo na pregled upita. */
async function assertPropertyAccess(admin: AdminUser, propertyId: number) {
  if (admin.role === "owner" && !(await hasAdminAccess(admin.id, { propertyId }))) {
    redirect("/admin/inquiries");
  }
}

/** Isto kao assertPropertyAccess, ali za jedan konkretan upit — provjerava kojoj
    vikendici/firmi upit pripada izravno preko hasAdminAccess (agencijski upiti,
    source="agency", nisu nikad dostupni vlasniku). */
async function assertInquiryAccess(admin: AdminUser, inquiry: Inquiry) {
  if (admin.role !== "owner") return;
  if (inquiry.source === "property" && inquiry.sourceId != null) {
    if (await hasAdminAccess(admin.id, { propertyId: inquiry.sourceId })) return;
  }
  if (inquiry.source === "company" && inquiry.sourceId != null) {
    if (await hasAdminAccess(admin.id, { companyId: inquiry.sourceId })) return;
  }
  redirect("/admin/inquiries");
}

/* ---------------------------------------------------------------- */
/* Agencija (jedini, singleton tekst)                                */
/* ---------------------------------------------------------------- */

const AgencySchema = z.object({
  heroTitle: z.string().min(1, "Naslov ne smije biti prazan."),
  officeText: z.string().min(1, "Tekst ne smije biti prazan."),
  contactEmail: z.string().email("Unesi ispravan email."),
  instagramHandle: z.string().min(1),
  city: z.string().min(1),
});

export async function updateAgencyAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = AgencySchema.safeParse({
    heroTitle: formData.get("heroTitle"),
    officeText: formData.get("officeText"),
    contactEmail: formData.get("contactEmail"),
    instagramHandle: formData.get("instagramHandle"),
    city: formData.get("city"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  await updateAgency(parsed.data);
  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true };
}

/* ---------------------------------------------------------------- */
/* Vikendice                                                         */
/* ---------------------------------------------------------------- */

const PropertySchema = z.object({
  slug: z
    .string()
    .min(1, "Slug je obavezan.")
    .regex(/^[a-z0-9-]+$/, "Slug smije sadržavati samo mala slova, brojke i crtice."),
  name: z.string().min(1, "Naziv je obavezan."),
  location: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  amenities: z.string(), // jedan po retku, parsiramo dolje
  priceFromEur: z.coerce.number().int().min(0),
  capacityGuests: z.coerce.number().int().min(1),
  bedrooms: z.coerce.number().int().min(0),
  distanceFromCenter: z.string().min(1),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Boja mora biti u obliku #RRGGBB."),
  images: z.string(), // JSON niz URL-ova, parsiramo dolje
  bannerImage: z.string().optional(),
  contactEmail: z
    .string()
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, {
      message: "Kontakt email vikendice mora biti ispravan email.",
    }),
  phone: z.string().optional(),
  published: z.coerce.boolean(),
  showInStudies: z.coerce.boolean(),
  layoutStyle: z.enum(["classic", "editorial", "raw", "apple"]).default("classic"),
  darkMode: z.coerce.boolean(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  houseRules: z.string().optional(), // jedan po retku, parsiramo kao amenities
  hostName: z.string().optional(),
  hostNote: z.string().optional(),
  mapUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Poveznica za mapu mora počinjati s http:// ili https://",
    }),
  address: z.string().optional(),
  testimonials: z.string().optional(), // JSON niz {author,text,rating}, parsiramo dolje
  faq: z.string().optional(), // JSON niz {question,answer}, parsiramo dolje
  imageCategories: z.string().optional(), // JSON objekt url->kategorija, parsiramo dolje
  videoUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Poveznica na video mora počinjati s http:// ili https://",
    }),
  seasonalPricing: z.string().optional(), // JSON niz {label,priceEur}, parsiramo dolje
  availabilityUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Poveznica na dostupnost mora počinjati s http:// ili https://",
    }),
  icalUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "iCal poveznica mora počinjati s http:// ili https://",
    }),
  hostPhoto: z.string().optional(),
  reviewBadges: z.string().optional(), // jedan po retku, parsiramo kao amenities
  faviconUrl: z.string().optional(),
  customDomain: z
    .string()
    .optional()
    .refine(
      (v) =>
        !v ||
        /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
          v.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
        ),
      { message: "Domena mora biti u obliku npr. vila-marija.com (bez https:// i bez kose crte)." }
    ),
});

function parseAmenities(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseImages(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s) => typeof s === "string" && s.trim().length > 0);
  } catch {
    return [];
  }
}

function parseTestimonials(raw?: string): { author: string; text: string; rating: number }[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t) => t && typeof t.author === "string" && typeof t.text === "string")
      .map((t) => ({
        author: t.author.trim(),
        text: t.text.trim(),
        rating: Math.min(5, Math.max(1, Math.round(Number(t.rating) || 5))),
      }))
      .filter((t) => t.author.length > 0 && t.text.length > 0);
  } catch {
    return [];
  }
}

function parseFaq(raw?: string): { question: string; answer: string }[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((f) => f && typeof f.question === "string" && typeof f.answer === "string")
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f) => f.question.length > 0 && f.answer.length > 0);
  } catch {
    return [];
  }
}

function parseSeasonalPricing(raw?: string): { label: string; priceEur: number }[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s.label === "string")
      .map((s) => ({ label: s.label.trim(), priceEur: Math.max(0, Math.round(Number(s.priceEur) || 0)) }))
      .filter((s) => s.label.length > 0);
  } catch {
    return [];
  }
}

function parseImageCategories(raw?: string): Record<string, string> {
  try {
    const obj = JSON.parse(raw ?? "{}");
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** Normalizira uneseni tekst domene ("https://Vila-Marija.com/" → "vila-marija.com"). */
function normalizeDomain(raw?: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  return trimmed
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export async function createPropertyAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = PropertySchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    location: formData.get("location"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    amenities: formData.get("amenities") ?? "",
    priceFromEur: formData.get("priceFromEur"),
    capacityGuests: formData.get("capacityGuests"),
    bedrooms: formData.get("bedrooms"),
    distanceFromCenter: formData.get("distanceFromCenter"),
    accentColor: formData.get("accentColor"),
    images: formData.get("images") ?? "[]",
    bannerImage: formData.get("bannerImage") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    phone: formData.get("phone") ?? "",
    published: formData.get("published") === "on",
    showInStudies: formData.get("showInStudies") === "on",
    layoutStyle: formData.get("layoutStyle") ?? "classic",
    darkMode: formData.get("darkMode") === "on",
    checkInTime: formData.get("checkInTime") ?? "",
    checkOutTime: formData.get("checkOutTime") ?? "",
    houseRules: formData.get("houseRules") ?? "",
    hostName: formData.get("hostName") ?? "",
    hostNote: formData.get("hostNote") ?? "",
    mapUrl: formData.get("mapUrl") ?? "",
    address: formData.get("address") ?? "",
    testimonials: formData.get("testimonials") ?? "[]",
    faq: formData.get("faq") ?? "[]",
    imageCategories: formData.get("imageCategories") ?? "{}",
    videoUrl: formData.get("videoUrl") ?? "",
    seasonalPricing: formData.get("seasonalPricing") ?? "[]",
    availabilityUrl: formData.get("availabilityUrl") ?? "",
    icalUrl: formData.get("icalUrl") ?? "",
    hostPhoto: formData.get("hostPhoto") ?? "",
    reviewBadges: formData.get("reviewBadges") ?? "",
    faviconUrl: formData.get("faviconUrl") ?? "",
    customDomain: formData.get("customDomain") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  if (RESERVED_SLUGS.has(parsed.data.slug)) {
    return { error: `"${parsed.data.slug}" je rezervirana adresa, odaberi drugu.` };
  }
  if (await isSlugTaken(parsed.data.slug)) {
    return { error: `Adresa "${parsed.data.slug}" je već zauzeta (vikendica ili firma) — odaberi drugu.` };
  }

  const address = parsed.data.address?.trim() || null;
  const coords = await resolveCoordinates(address);
  const geoMissed = !!address && !coords.latitude;

  let created;
  try {
    created = await createProperty({
      ...parsed.data,
      amenities: parseAmenities(parsed.data.amenities),
      images: parseImages(parsed.data.images),
      bannerImage: parsed.data.bannerImage?.trim() || null,
      contactEmail: parsed.data.contactEmail?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      checkInTime: parsed.data.checkInTime?.trim() || null,
      checkOutTime: parsed.data.checkOutTime?.trim() || null,
      houseRules: parseAmenities(parsed.data.houseRules ?? ""),
      hostName: parsed.data.hostName?.trim() || null,
      hostNote: parsed.data.hostNote?.trim() || null,
      mapUrl: parsed.data.mapUrl?.trim() || null,
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
      testimonials: parseTestimonials(parsed.data.testimonials),
      faq: parseFaq(parsed.data.faq),
      imageCategories: parseImageCategories(parsed.data.imageCategories),
      videoUrl: parsed.data.videoUrl?.trim() || null,
      seasonalPricing: parseSeasonalPricing(parsed.data.seasonalPricing),
      availabilityUrl: parsed.data.availabilityUrl?.trim() || null,
      icalUrl: parsed.data.icalUrl?.trim() || null,
      hostPhoto: parsed.data.hostPhoto?.trim() || null,
      reviewBadges: parseAmenities(parsed.data.reviewBadges ?? ""),
      faviconUrl: parsed.data.faviconUrl?.trim() || null,
      customDomain: normalizeDomain(parsed.data.customDomain),
    });
  } catch {
    return { error: "Ta adresa (slug) ili domena je već zauzeta — odaberi drugu." };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  // Ako karta nije uspjela, vrati admina na stranicu za uređivanje (umjesto
  // na popis) s upozorenjem — vidi geoMissWarning i app/admin/properties/[id]/page.tsx.
  if (geoMissed && created) {
    redirect(`/admin/properties/${created.id}?geo=miss`);
  }
  redirect("/admin");
}

export async function updatePropertyAction(
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = PropertySchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    location: formData.get("location"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    amenities: formData.get("amenities") ?? "",
    priceFromEur: formData.get("priceFromEur"),
    capacityGuests: formData.get("capacityGuests"),
    bedrooms: formData.get("bedrooms"),
    distanceFromCenter: formData.get("distanceFromCenter"),
    accentColor: formData.get("accentColor"),
    images: formData.get("images") ?? "[]",
    bannerImage: formData.get("bannerImage") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    phone: formData.get("phone") ?? "",
    published: formData.get("published") === "on",
    showInStudies: formData.get("showInStudies") === "on",
    layoutStyle: formData.get("layoutStyle") ?? "classic",
    darkMode: formData.get("darkMode") === "on",
    checkInTime: formData.get("checkInTime") ?? "",
    checkOutTime: formData.get("checkOutTime") ?? "",
    houseRules: formData.get("houseRules") ?? "",
    hostName: formData.get("hostName") ?? "",
    hostNote: formData.get("hostNote") ?? "",
    mapUrl: formData.get("mapUrl") ?? "",
    address: formData.get("address") ?? "",
    testimonials: formData.get("testimonials") ?? "[]",
    faq: formData.get("faq") ?? "[]",
    imageCategories: formData.get("imageCategories") ?? "{}",
    videoUrl: formData.get("videoUrl") ?? "",
    seasonalPricing: formData.get("seasonalPricing") ?? "[]",
    availabilityUrl: formData.get("availabilityUrl") ?? "",
    icalUrl: formData.get("icalUrl") ?? "",
    hostPhoto: formData.get("hostPhoto") ?? "",
    reviewBadges: formData.get("reviewBadges") ?? "",
    faviconUrl: formData.get("faviconUrl") ?? "",
    customDomain: formData.get("customDomain") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  if (RESERVED_SLUGS.has(parsed.data.slug)) {
    return { error: `"${parsed.data.slug}" je rezervirana adresa, odaberi drugu.` };
  }
  if (await isSlugTaken(parsed.data.slug, { table: "properties", id })) {
    return { error: `Adresa "${parsed.data.slug}" je već zauzeta (vikendica ili firma) — odaberi drugu.` };
  }

  const address = parsed.data.address?.trim() || null;
  const existing = await getPropertyById(id);
  const coords = await resolveCoordinates(address, existing ?? undefined);
  const geoMissed = !!address && !coords.latitude;

  try {
    await updateProperty(id, {
      ...parsed.data,
      amenities: parseAmenities(parsed.data.amenities),
      images: parseImages(parsed.data.images),
      bannerImage: parsed.data.bannerImage?.trim() || null,
      contactEmail: parsed.data.contactEmail?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      checkInTime: parsed.data.checkInTime?.trim() || null,
      checkOutTime: parsed.data.checkOutTime?.trim() || null,
      houseRules: parseAmenities(parsed.data.houseRules ?? ""),
      hostName: parsed.data.hostName?.trim() || null,
      hostNote: parsed.data.hostNote?.trim() || null,
      mapUrl: parsed.data.mapUrl?.trim() || null,
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
      testimonials: parseTestimonials(parsed.data.testimonials),
      faq: parseFaq(parsed.data.faq),
      imageCategories: parseImageCategories(parsed.data.imageCategories),
      videoUrl: parsed.data.videoUrl?.trim() || null,
      seasonalPricing: parseSeasonalPricing(parsed.data.seasonalPricing),
      availabilityUrl: parsed.data.availabilityUrl?.trim() || null,
      icalUrl: parsed.data.icalUrl?.trim() || null,
      hostPhoto: parsed.data.hostPhoto?.trim() || null,
      reviewBadges: parseAmenities(parsed.data.reviewBadges ?? ""),
      faviconUrl: parsed.data.faviconUrl?.trim() || null,
      customDomain: normalizeDomain(parsed.data.customDomain),
    });
  } catch {
    return { error: "Ta adresa (slug) ili domena je već zauzeta — odaberi drugu." };
  }

  revalidatePath("/");
  revalidatePath(`/${parsed.data.slug}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/properties/${id}`);
  return { success: true, warning: geoMissed && address ? geoMissWarning(address) : undefined };
}

export async function deletePropertyAction(id: number) {
  await requireAdmin();
  await deleteProperty(id);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

/* ---------------------------------------------------------------- */
/* Firme (puna stranica poput vikendice, bez booking polja)          */
/* ---------------------------------------------------------------- */

const CompanySchema = z.object({
  slug: z
    .string()
    .min(1, "Slug je obavezan.")
    .regex(/^[a-z0-9-]+$/, "Slug smije sadržavati samo mala slova, brojke i crtice."),
  name: z.string().min(1, "Naziv je obavezan."),
  location: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  services: z.string().optional(), // JSON niz {name,description,priceEur}, parsiramo dolje
  workingHours: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  instagramUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Poveznica na Instagram mora počinjati s http:// ili https://",
    }),
  facebookUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Poveznica na Facebook mora počinjati s http:// ili https://",
    }),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Boja mora biti u obliku #RRGGBB."),
  images: z.string(), // JSON niz URL-ova, parsiramo gore definiranim parseImages
  bannerImage: z.string().optional(),
  contactEmail: z
    .string()
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, {
      message: "Kontakt email firme mora biti ispravan email.",
    }),
  published: z.coerce.boolean(),
  layoutStyle: z.enum(["classic", "editorial", "raw", "apple"]).default("classic"),
  darkMode: z.coerce.boolean(),
  mapUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Poveznica za mapu mora počinjati s http:// ili https://",
    }),
  testimonials: z.string().optional(),
  faq: z.string().optional(),
  imageCategories: z.string().optional(),
  videoUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Poveznica na video mora počinjati s http:// ili https://",
    }),
  reviewBadges: z.string().optional(),
  faviconUrl: z.string().optional(),
  customDomain: z
    .string()
    .optional()
    .refine(
      (v) =>
        !v ||
        /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
          v.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
        ),
      { message: "Domena mora biti u obliku npr. tvrtka.com (bez https:// i bez kose crte)." }
    ),
});

function parseServices(raw?: string): { name: string; description: string; priceEur: number | null }[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s.name === "string")
      .map((s) => ({
        name: s.name.trim(),
        description: typeof s.description === "string" ? s.description.trim() : "",
        priceEur:
          s.priceEur === null || s.priceEur === undefined || s.priceEur === ""
            ? null
            : Math.max(0, Math.round(Number(s.priceEur) || 0)),
      }))
      .filter((s) => s.name.length > 0);
  } catch {
    return [];
  }
}

function readCompanyFormData(formData: FormData) {
  return {
    slug: formData.get("slug"),
    name: formData.get("name"),
    location: formData.get("location"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    services: formData.get("services") ?? "[]",
    workingHours: formData.get("workingHours") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    instagramUrl: formData.get("instagramUrl") ?? "",
    facebookUrl: formData.get("facebookUrl") ?? "",
    accentColor: formData.get("accentColor"),
    images: formData.get("images") ?? "[]",
    bannerImage: formData.get("bannerImage") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    published: formData.get("published") === "on",
    layoutStyle: formData.get("layoutStyle") ?? "classic",
    darkMode: formData.get("darkMode") === "on",
    mapUrl: formData.get("mapUrl") ?? "",
    testimonials: formData.get("testimonials") ?? "[]",
    faq: formData.get("faq") ?? "[]",
    imageCategories: formData.get("imageCategories") ?? "{}",
    videoUrl: formData.get("videoUrl") ?? "",
    reviewBadges: formData.get("reviewBadges") ?? "",
    faviconUrl: formData.get("faviconUrl") ?? "",
    customDomain: formData.get("customDomain") ?? "",
  };
}

export async function createCompanyAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = CompanySchema.safeParse(readCompanyFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  if (RESERVED_SLUGS.has(parsed.data.slug)) {
    return { error: `"${parsed.data.slug}" je rezervirana adresa, odaberi drugu.` };
  }
  if (await isSlugTaken(parsed.data.slug)) {
    return { error: `Adresa "${parsed.data.slug}" je već zauzeta (vikendica ili firma) — odaberi drugu.` };
  }

  try {
    await createCompany({
      ...parsed.data,
      services: parseServices(parsed.data.services),
      workingHours: parsed.data.workingHours?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      address: parsed.data.address?.trim() || null,
      instagramUrl: parsed.data.instagramUrl?.trim() || null,
      facebookUrl: parsed.data.facebookUrl?.trim() || null,
      images: parseImages(parsed.data.images),
      bannerImage: parsed.data.bannerImage?.trim() || null,
      contactEmail: parsed.data.contactEmail?.trim() || null,
      mapUrl: parsed.data.mapUrl?.trim() || null,
      testimonials: parseTestimonials(parsed.data.testimonials),
      faq: parseFaq(parsed.data.faq),
      imageCategories: parseImageCategories(parsed.data.imageCategories),
      videoUrl: parsed.data.videoUrl?.trim() || null,
      reviewBadges: parseAmenities(parsed.data.reviewBadges ?? ""),
      faviconUrl: parsed.data.faviconUrl?.trim() || null,
      customDomain: normalizeDomain(parsed.data.customDomain),
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      return { error: "Baza još nema tablicu za firme — pokreni SQL migraciju (poslana zasebno) pa pokušaj ponovno." };
    }
    return { error: "Ta adresa (slug) ili domena je već zauzeta — odaberi drugu." };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateCompanyAction(
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = CompanySchema.safeParse(readCompanyFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  if (RESERVED_SLUGS.has(parsed.data.slug)) {
    return { error: `"${parsed.data.slug}" je rezervirana adresa, odaberi drugu.` };
  }
  if (await isSlugTaken(parsed.data.slug, { table: "companies", id })) {
    return { error: `Adresa "${parsed.data.slug}" je već zauzeta (vikendica ili firma) — odaberi drugu.` };
  }

  try {
    await updateCompany(id, {
      ...parsed.data,
      services: parseServices(parsed.data.services),
      workingHours: parsed.data.workingHours?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      address: parsed.data.address?.trim() || null,
      instagramUrl: parsed.data.instagramUrl?.trim() || null,
      facebookUrl: parsed.data.facebookUrl?.trim() || null,
      images: parseImages(parsed.data.images),
      bannerImage: parsed.data.bannerImage?.trim() || null,
      contactEmail: parsed.data.contactEmail?.trim() || null,
      mapUrl: parsed.data.mapUrl?.trim() || null,
      testimonials: parseTestimonials(parsed.data.testimonials),
      faq: parseFaq(parsed.data.faq),
      imageCategories: parseImageCategories(parsed.data.imageCategories),
      videoUrl: parsed.data.videoUrl?.trim() || null,
      reviewBadges: parseAmenities(parsed.data.reviewBadges ?? ""),
      faviconUrl: parsed.data.faviconUrl?.trim() || null,
      customDomain: normalizeDomain(parsed.data.customDomain),
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      return { error: "Baza još nema tablicu za firme — pokreni SQL migraciju (poslana zasebno) pa pokušaj ponovno." };
    }
    return { error: "Ta adresa (slug) ili domena je već zauzeta — odaberi drugu." };
  }

  revalidatePath("/");
  revalidatePath(`/${parsed.data.slug}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/companies/${id}`);
  return { success: true };
}

export async function deleteCompanyAction(id: number) {
  await requireAdmin();
  await deleteCompany(id);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

/* ---------------------------------------------------------------- */
/* Studies (opći portfolio unosi — brend identitet, dizajn, film...) */
/* ---------------------------------------------------------------- */

const StudySchema = z.object({
  title: z.string().min(1, "Naslov je obavezan."),
  category: z.string().min(1, "Kategorija je obavezna."),
  tagline: z.string().min(1, "Slogan je obavezan."),
  description: z.string().min(1, "Opis je obavezan."),
  year: z.coerce.number().int().min(1900).max(2100),
  images: z.string(), // JSON niz URL-ova, parsiramo gore definiranim parseImages
  externalUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Poveznica mora počinjati s http:// ili https://",
    }),
  published: z.coerce.boolean(),
  position: z.coerce.number().int().default(0),
});

function readStudyFormData(formData: FormData) {
  return {
    title: formData.get("title"),
    category: formData.get("category"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    year: formData.get("year"),
    images: formData.get("images") ?? "[]",
    externalUrl: formData.get("externalUrl") ?? "",
    published: formData.get("published") === "on",
    position: formData.get("position") ?? "0",
  };
}

export async function createStudyAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = StudySchema.safeParse(readStudyFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  await createStudy({
    ...parsed.data,
    images: parseImages(parsed.data.images),
    externalUrl: parsed.data.externalUrl?.trim() || null,
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateStudyAction(
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = StudySchema.safeParse(readStudyFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  await updateStudy(id, {
    ...parsed.data,
    images: parseImages(parsed.data.images),
    externalUrl: parsed.data.externalUrl?.trim() || null,
  });
  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteStudyAction(id: number) {
  await requireAdmin();
  await deleteStudy(id);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

/* ---------------------------------------------------------------- */
/* Proizvodi (fizički proizvodi — 3D printane pločice s NFC oznakama) */
/* ---------------------------------------------------------------- */

const ProductSchema = z.object({
  name: z.string().min(1, "Naziv je obavezan."),
  tagline: z.string().min(1, "Kratki opis je obavezan."),
  description: z.string().min(1, "Opis je obavezan."),
  priceEur: z.string().optional(),
  images: z.string(), // JSON niz URL-ova, parsiramo gore definiranim parseImages
  features: z.string().optional(), // jedan po retku, parsiramo kao amenities
  published: z.coerce.boolean(),
  position: z.coerce.number().int().default(0),
});

function readProductFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    priceEur: formData.get("priceEur") ?? "",
    images: formData.get("images") ?? "[]",
    features: formData.get("features") ?? "",
    published: formData.get("published") === "on",
    position: formData.get("position") ?? "0",
  };
}

function parsePriceEur(raw?: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export async function createProductAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = ProductSchema.safeParse(readProductFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  await createProduct({
    ...parsed.data,
    priceEur: parsePriceEur(parsed.data.priceEur),
    images: parseImages(parsed.data.images),
    features: parseAmenities(parsed.data.features ?? ""),
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateProductAction(
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = ProductSchema.safeParse(readProductFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  await updateProduct(id, {
    ...parsed.data,
    priceEur: parsePriceEur(parsed.data.priceEur),
    images: parseImages(parsed.data.images),
    features: parseAmenities(parsed.data.features ?? ""),
  });
  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteProductAction(id: number) {
  await requireAdmin();
  await deleteProduct(id);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

/* ---------------------------------------------------------------- */
/* Upiti (javni obrazac na stranici vikendice/firme/agencije)        */
/* ---------------------------------------------------------------- */

const InquirySchema = z.object({
  source: z.enum(["property", "company", "agency"]),
  sourceId: z.string().optional(),
  sourceName: z.string().min(1),
  name: z.string().min(1, "Unesi ime i prezime."),
  email: z.string().email("Unesi ispravan email."),
  phone: z.string().optional(),
  message: z
    .string()
    .min(1, "Poruka ne smije biti prazna.")
    .max(4000, "Poruka je predugačka."),
  // Honeypot — botovi ovo skriveno polje često popune, pravi posjetitelji ga
  // ne vide (sakriveno CSS-om) pa ostaje prazno.
  website: z.string().optional(),
});

/** Max broj upita dopušten s iste IP adrese unutar prozora ispod — jednostavna zaštita od spama. */
const INQUIRY_RATE_LIMIT_MAX = 5;
const INQUIRY_RATE_LIMIT_WINDOW_MINUTES = 10;

/** Prva vrijednost iz x-forwarded-for je klijentova stvarna IP adresa (Vercel je postavlja). */
async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

export async function createInquiryAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = InquirySchema.safeParse({
    source: formData.get("source"),
    sourceId: formData.get("sourceId") ?? "",
    sourceName: formData.get("sourceName"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }

  // Bota se pretvaramo da je poruka poslana (ne odajemo da smo ga prepoznali),
  // ali ništa ne spremamo u bazu.
  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    return { success: true };
  }

  const sourceId = parsed.data.sourceId ? Number(parsed.data.sourceId) || null : null;
  const ip = await getClientIp();

  if (ip) {
    const since = new Date(Date.now() - INQUIRY_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
    const recentCount = await countRecentInquiriesByIp(ip, since);
    if (recentCount >= INQUIRY_RATE_LIMIT_MAX) {
      return { error: "Poslano je previše upita u kratkom vremenu — pokušaj ponovno za koji minut." };
    }
  }

  try {
    await createInquiry({
      source: parsed.data.source,
      sourceId,
      sourceName: parsed.data.sourceName.trim(),
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim(),
      phone: parsed.data.phone?.trim() || null,
      message: parsed.data.message.trim(),
      ip,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      return {
        error: "Slanje upita trenutno nije dostupno — kontaktiraj nas izravno mailom, molimo.",
      };
    }
    return { error: "Slanje nije uspjelo — pokušaj ponovno." };
  }

  // Email obavijest vlasniku i potvrda gostu — "best effort", nikad ne smije
  // srušiti odgovor korisniku (upit je već sigurno spremljen iznad).
  try {
    const recipient = await resolveInquiryRecipient(parsed.data.source, sourceId);
    if (recipient) {
      await sendInquiryNotification({
        to: recipient,
        sourceName: parsed.data.sourceName.trim(),
        name: parsed.data.name.trim(),
        email: parsed.data.email.trim(),
        phone: parsed.data.phone?.trim() || null,
        message: parsed.data.message.trim(),
      });
    }
  } catch (err) {
    // Ne rušimo odgovor korisniku (upit je već spremljen iznad), ali
    // logiramo grešku da je vidimo u Vercel Runtime Logs radi dijagnostike.
    console.error("[createInquiryAction] slanje email obavijesti nije uspjelo:", err);
  }

  try {
    await sendGuestConfirmation({
      to: parsed.data.email.trim(),
      sourceName: parsed.data.sourceName.trim(),
      name: parsed.data.name.trim(),
    });
  } catch (err) {
    console.error("[createInquiryAction] slanje potvrde gostu nije uspjelo:", err);
  }

  revalidatePath("/admin/inquiries");
  return { success: true };
}

/** Kontakt-email vikendice/firme na koji ide obavijest o novom upitu; pada
    natrag na agencijski email ako specifičan nije postavljen (isti lanac
    fallbackova kao za "Pošaljite upit" mailto gumbe na /[slug] stranici). */
async function resolveInquiryRecipient(
  source: "property" | "company" | "agency",
  sourceId: number | null
): Promise<string | null> {
  const agency = await getAgency();
  if (source === "property" && sourceId) {
    const property = await getPropertyById(sourceId);
    if (property?.contactEmail) return property.contactEmail;
  }
  if (source === "company" && sourceId) {
    const company = await getCompanyById(sourceId);
    if (company?.contactEmail) return company.contactEmail;
  }
  return agency?.contactEmail || null;
}

export async function markInquiryReadAction(id: number) {
  // Vlasnik smije označiti pročitano/odgovoreno SAMO na upitima svoje vikendice/firme.
  const admin = await requireAdminOrOwner();
  const inquiry = await getInquiryById(id);
  if (!inquiry) redirect("/admin/inquiries");
  await assertInquiryAccess(admin, inquiry);
  await markInquiryRead(id);
  revalidatePath("/admin/inquiries");
}

export async function markInquiryRepliedAction(id: number) {
  const admin = await requireAdminOrOwner();
  const inquiry = await getInquiryById(id);
  if (!inquiry) redirect("/admin/inquiries");
  await assertInquiryAccess(admin, inquiry);
  await markInquiryReplied(id);
  revalidatePath("/admin/inquiries");
}

/** Brzi odgovor gostu izravno iz admina (umjesto ručno mailom/telefonom) —
    "message" dolazi iz predloška ili slobodnog teksta na app/admin/inquiries
    (vidi components/admin/QuickReplyForm). Šalje se na inquiry.email preko
    Resend (vidi lib/email.ts sendInquiryReply) i automatski označava
    odgovoreno. "Best effort" kao i ostali mailovi — ako Resend nije
    postavljen ili slanje ne uspije, javljamo grešku nazad da admin zna da
    NIJE poslano (za razliku od notifikacija koje su tihe, ovo gost čeka). */
export async function sendInquiryReplyAction(
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminOrOwner();
  const inquiry = await getInquiryById(id);
  if (!inquiry) redirect("/admin/inquiries");
  await assertInquiryAccess(admin, inquiry);

  const message = String(formData.get("message") || "").trim();
  if (!message) return { error: "Poruka ne smije biti prazna." };

  const sent = await sendInquiryReply({
    to: inquiry.email,
    guestName: inquiry.name,
    sourceName: inquiry.sourceName,
    message,
  });
  if (!sent) {
    return { error: "Slanje nije uspjelo (provjeri je li Resend povezan) — pokušaj ponovno ili odgovori ručno." };
  }

  await markInquiryReplied(id);
  revalidatePath("/admin/inquiries");
  return { success: true };
}

export async function deleteInquiryAction(id: number) {
  // Brisanje ostaje samo za pune admine (vlasnik ne smije ništa trajno uklanjati).
  await requireAdmin();
  await deleteInquiry(id);
  revalidatePath("/admin/inquiries");
  redirect("/admin/inquiries");
}

/* ---------------------------------------------------------------- */
/* Admini (samo glavni admin smije upravljati drugim adminima)       */
/* ---------------------------------------------------------------- */

const AdminSchema = z.object({
  email: z.string().email({ message: "Unesi ispravan email." }),
  password: z.string().min(8, { message: "Lozinka mora imati barem 8 znakova." }),
  role: z.enum(["admin", "owner"]).default("admin"),
  propertyIds: z.array(z.coerce.number().int()).default([]),
  companyIds: z.array(z.coerce.number().int()).default([]),
});

export async function createAdminAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = AdminSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") || "admin",
    propertyIds: formData.getAll("propertyIds"),
    companyIds: formData.getAll("companyIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  if (parsed.data.role === "owner" && parsed.data.propertyIds.length === 0 && parsed.data.companyIds.length === 0) {
    return { error: "Odaberi barem jednu vikendicu ili firmu za vlasnički račun." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await findAdminByEmail(email);
  if (existing) {
    return { error: "Već postoji admin s tim emailom." };
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const created = await createAdmin({
    email,
    passwordHash,
    isSuperAdmin: false,
    role: parsed.data.role,
  });
  if (parsed.data.role === "owner") {
    await setAdminAccess(created.id, {
      propertyIds: parsed.data.propertyIds,
      companyIds: parsed.data.companyIds,
    });
  }
  revalidatePath("/admin/admins");
  redirect("/admin/admins");
}

export async function deleteAdminAction(id: number) {
  const { adminId, row } = await requireSuperAdmin();
  if (id === adminId) {
    // ne dopuštamo da glavni admin sam sebe obriše (zaključao bi se van)
    redirect("/admin/admins");
  }
  const target = row.id === id ? row : await getAdminById(id);
  if (target?.isSuperAdmin) {
    const total = await countAdmins();
    if (total <= 1) {
      redirect("/admin/admins");
    }
  }
  await deleteAdmin(id);
  revalidatePath("/admin/admins");
  redirect("/admin/admins");
}

/* ---------------------------------------------------------------- */
/* Promjena vlastite lozinke (bilo koji prijavljeni admin)           */
/* ---------------------------------------------------------------- */

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Unesi trenutnu lozinku." }),
    newPassword: z.string().min(8, { message: "Nova lozinka mora imati barem 8 znakova." }),
    confirmPassword: z.string().min(1, { message: "Ponovi novu lozinku." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Nova lozinka i ponovljena lozinka se ne podudaraju.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Promjena vlastite lozinke je dopuštena i vlasniku (owner), ne samo punom adminu.
  const row = await requireAdminOrOwner();
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
  if (!valid) {
    return { error: "Trenutna lozinka nije točna." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await updateAdminPassword(row.id, passwordHash);
  return { success: true };
}

/* ---------------------------------------------------------------- */
/* Dvofaktorska prijava (2FA/TOTP) — samo-postavljanje na             */
/* /admin/settings, dostupno i vlasniku (requireAdminOrOwner) kao i   */
/* promjena lozinke, jer se odnosi samo na SIGURNOST VLASTITOG računa. */
/* ---------------------------------------------------------------- */

export type TwoFactorSetupState =
  | { error?: string; qrDataUrl?: string; secretDisplay?: string }
  | undefined;

/** Korak 1: generira novu TOTP tajnu i sprema je (twoFactorEnabled ostaje
    false — vidi setTwoFactorSecret) te vraća QR kod za skeniranje. Admin još
    NIJE zaštićen 2FA-om dok ne unese jedan ispravan kod u koraku 2
    (confirmTwoFactorSetupAction) — inače bi krivo skeniran QR mogao
    zaključati admina iz vlastitog računa. */
// useActionState traži oblik (state, payload) — ovaj prvi korak ne treba ni jedno ni drugo.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function startTwoFactorSetupAction(
  _prevState: TwoFactorSetupState,
  _formData: FormData
): Promise<TwoFactorSetupState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const row = await requireAdminOrOwner();
  const secret = new Secret({ size: 20 });
  await setTwoFactorSecret(row.id, secret.base32);
  const totp = buildTotp(row.email, secret);
  const qrDataUrl = await QRCode.toDataURL(totp.toString());
  return { qrDataUrl, secretDisplay: secret.base32 };
}

const TwoFactorConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: "Unesi 6-znamenkasti kod iz aplikacije." }),
});

/** Korak 2: potvrđuje da je admin uspješno skenirao/unio tajnu u svoju
    aplikaciju za autentifikaciju tražeći JEDAN ispravan kod prije nego što
    stvarno uključi 2FA na prijavi. */
export async function confirmTwoFactorSetupAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const row = await requireAdminOrOwner();
  if (!row.twoFactorSecret) {
    return { error: "Prvo pokreni postavljanje 2FA (osvježi stranicu i pokušaj ponovno)." };
  }
  const parsed = TwoFactorConfirmSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Unesi 6-znamenkasti kod." };
  }

  const totp = buildTotp(row.email, Secret.fromBase32(row.twoFactorSecret));
  const delta = totp.validate({ token: parsed.data.code, window: 1 });
  if (delta === null) {
    return { error: "Kod nije ispravan. Provjeri je li vrijeme na telefonu točno, pa pokušaj ponovno." };
  }

  await enableTwoFactor(row.id);
  return { success: true };
}

const TwoFactorDisableSchema = z.object({
  currentPassword: z.string().min(1, { message: "Unesi trenutnu lozinku." }),
});

/** Isključivanje 2FA — traži trenutnu lozinku kao potvrdu, isti sigurnosni
    obrazac kao changePasswordAction iznad (osjetljiva promjena = ponovno
    upisana lozinka, ne samo klik). */
export async function disableTwoFactorAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const row = await requireAdminOrOwner();
  const parsed = TwoFactorDisableSchema.safeParse({ currentPassword: formData.get("currentPassword") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Unesi trenutnu lozinku." };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
  if (!valid) {
    return { error: "Trenutna lozinka nije točna." };
  }

  await disableTwoFactor(row.id);
  return { success: true };
}

/* ---------------------------------------------------------------- */
/* Kalendar dostupnosti — ručno blokiranje/deblokiranje datuma        */
/* (vidi app/admin/kalendar). "ical"-izvorni datumi se ovdje ne diraju */
/* — oni se upravljaju samo preko app/api/cron/sync-ical.             */
/* ---------------------------------------------------------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function toggleBlockedDateAction(
  propertyId: number,
  date: string,
  currentlyBlocked: boolean
) {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);
  if (!DATE_RE.test(date)) redirect("/admin/kalendar");

  if (currentlyBlocked) {
    await removeManualBlockedDate(propertyId, date);
  } else {
    await addManualBlockedDate(propertyId, date);
  }
  revalidatePath("/admin/kalendar");
}

/** Blokira cijeli raspon datuma odjednom ("Blokiraj raspon" forma na
    /admin/kalendar) umjesto klikanja dan po dan — vidi blockManualDateRange.
    `redirectTo` je puni URL natrag na kalendar (ista vikendica/mjesec) koji
    stranica sastavi preko linkFor(), da admin ostane gdje je bio. */
export async function blockDateRangeAction(
  propertyId: number,
  redirectTo: string,
  formData: FormData
) {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);

  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
    redirect(redirectTo);
  }

  // Sigurnosna gornja granica (cca 2 godine) — spriječi slučajni ogroman
  // raspon (npr. zamijenjena godina u polju) da ne napravi tisuće redaka.
  const MAX_RANGE_DAYS = 730;
  const spanDays = Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000
  );
  if (spanDays > MAX_RANGE_DAYS) {
    redirect(redirectTo);
  }

  await blockManualDateRange(propertyId, start, end);
  revalidatePath("/admin/kalendar");
  redirect(redirectTo);
}

/* ---------------------------------------------------------------- */
/* Rezervacije (puna knjiga rezervacija) — vidi app/admin/rezervacije. */
/* Zamjena za vlasnikovu bilježnicu: gost, datumi, cijena, status       */
/* plaćanja. Kreiranje automatski blokira noćenja u kalendaru (vidi     */
/* lib/db/queries.ts createReservation), brisanje ih uklanja.           */
/* ---------------------------------------------------------------- */

const ReservationSchema = z.object({
  guestName: z.string().min(1, "Ime gosta je obavezno."),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Email gosta mora biti ispravan email.",
    }),
  checkIn: z.string().regex(DATE_RE, "Datum dolaska nije ispravan."),
  checkOut: z.string().regex(DATE_RE, "Datum odlaska nije ispravan."),
  priceEur: z.coerce.number().int().min(0, "Cijena ne smije biti negativna."),
  paid: z.coerce.boolean(),
  guestCount: z.coerce.number().int().min(1).optional(),
  depositEur: z.coerce.number().int().min(0).optional(),
  note: z.string().optional(),
});

export async function createReservationAction(
  propertyId: number,
  redirectTo: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);

  const parsed = ReservationSchema.safeParse({
    guestName: formData.get("guestName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    priceEur: formData.get("priceEur"),
    paid: formData.get("paid"),
    guestCount: formData.get("guestCount") || undefined,
    depositEur: formData.get("depositEur") || undefined,
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  if (parsed.data.checkOut <= parsed.data.checkIn) {
    return { error: "Datum odlaska mora biti nakon datuma dolaska." };
  }

  const { reservation, overlappingDates } = await createReservation({
    propertyId,
    guestName: parsed.data.guestName,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    checkIn: parsed.data.checkIn,
    checkOut: parsed.data.checkOut,
    priceEur: parsed.data.priceEur,
    paid: parsed.data.paid,
    guestCount: parsed.data.guestCount ?? null,
    depositEur: parsed.data.depositEur ?? null,
    note: parsed.data.note || null,
  });
  await logActivity({
    adminEmail: admin.email,
    action: "created_reservation",
    targetLabel: `${parsed.data.guestName} (${parsed.data.checkIn} → ${parsed.data.checkOut})`,
    propertyId,
  });

  // Jedan dohvat vikendice za oboje ispod: upozorenje o kapacitetu (NE
  // blokira spremanje, samo upozorava, isto kao overlappingDates ispod) i
  // automatska email potvrda gostu ako je upisan email — "best effort",
  // vidi lib/email.ts komentar (nikad ne smije srušiti spremanje rezervacije).
  const property = await getPropertyById(propertyId);
  const capacityWarning =
    parsed.data.guestCount != null && !!property && parsed.data.guestCount > property.capacityGuests;

  if (parsed.data.email && property) {
    await sendReservationConfirmation({
      to: parsed.data.email,
      guestName: parsed.data.guestName,
      propertyName: property.name,
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
    });
    await markReservationConfirmationSent(reservation.id);
  }

  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin/kalendar");
  revalidatePath("/admin");
  revalidatePath("/admin/vikendice");
  // redirect() umjesto { success: true } — isprazni formu za sljedeći unos
  // (isti razlog kao redirect("/admin") u createStudyAction/createProductAction).
  // Ako se neki od odabranih dana već preklapao s postojećim blokiranim danom
  // (ručno, iCal ili druga rezervacija — vidi createReservation), dodaj
  // ?overlap=N na redirect da stranica prikaže upozorenje o mogućoj
  // dvostrukoj rezervaciji. Rezervacija se SVEJEDNO spremi — ovo je
  // upozorenje, ne blokada, jer vlasnik ponekad ispravlja pogrešan unos.
  const params: string[] = [];
  if (overlappingDates.length > 0) params.push(`overlap=${overlappingDates.length}`);
  if (capacityWarning) params.push("capacityWarning=1");
  redirect(params.length > 0 ? `${redirectTo}&${params.join("&")}` : redirectTo);
}

export async function deleteReservationAction(propertyId: number, id: number, guestName: string) {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);
  await deleteReservation(id);
  await logActivity({ adminEmail: admin.email, action: "deleted_reservation", targetLabel: guestName, propertyId });
  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin/kalendar");
  revalidatePath("/admin");
  revalidatePath("/admin/vikendice");
}

/** Označi/odznači je li vlasnik stvarno naplatio — SAMO plaćene rezervacije
    ulaze u "zaradu ovaj mjesec" na dashboardu (vidi getMonthlyEarnings). */
export async function toggleReservationPaidAction(
  propertyId: number,
  id: number,
  currentlyPaid: boolean
) {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);
  await setReservationPaid(id, !currentlyPaid);
  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin");
}

/** Postavlja/briše kaparu — informativno, vidi reservations.depositEur u
    schema.ts. Obična (ne useActionState) forma kao toggleReservationPaidAction
    gore — bez prikaza greške, negativan/neispravan unos se tiho ignorira jer
    je input type="number" min={0} već sprječava na klijentu. */
export async function setReservationDepositAction(propertyId: number, id: number, formData: FormData) {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);
  const raw = formData.get("depositEur");
  const depositEur = raw && String(raw).trim() !== "" ? Number(raw) : null;
  if (depositEur != null && (!Number.isFinite(depositEur) || depositEur < 0)) return;
  await setReservationDeposit(id, depositEur);
  revalidatePath("/admin/rezervacije");
}

/* ---------------------------------------------------------------- */
/* Troškovi (opcionalno, za neto zaradu) — vidi app/admin/rezervacije. */
/* ---------------------------------------------------------------- */

const EXPENSE_CATEGORIES = ["čišćenje", "održavanje", "režije", "ostalo"] as const;

const ExpenseSchema = z.object({
  description: z.string().min(1, "Opis je obavezan."),
  amountEur: z.coerce.number().int().min(0, "Iznos ne smije biti negativan."),
  date: z.string().regex(DATE_RE, "Datum nije ispravan."),
  category: z.enum(EXPENSE_CATEGORIES).default("ostalo"),
});

export async function createExpenseAction(
  propertyId: number,
  redirectTo: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);

  const parsed = ExpenseSchema.safeParse({
    description: formData.get("description"),
    amountEur: formData.get("amountEur"),
    date: formData.get("date"),
    category: formData.get("category") || "ostalo",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }

  await createExpense({ propertyId, ...parsed.data });
  await logActivity({
    adminEmail: admin.email,
    action: "created_expense",
    targetLabel: `${parsed.data.description} (${parsed.data.amountEur} €)`,
    propertyId,
  });
  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin");
  // redirect() umjesto { success: true } — isprazni formu za sljedeći unos.
  redirect(redirectTo);
}

export async function deleteExpenseAction(propertyId: number, id: number, description: string) {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);
  await deleteExpense(id);
  await logActivity({ adminEmail: admin.email, action: "deleted_expense", targetLabel: description, propertyId });
  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin");
}

/* ---------------------------------------------------------------- */
/* Zarada agencije (prodaja stranica/proizvoda/usluga) — vidi         */
/* app/admin/prodaja. Samo puni admini (requireAdmin), NE vlasnici —  */
/* vlasnici vide samo svoje vikendice, ovo je agencijska knjiga.      */
/* ---------------------------------------------------------------- */

const SaleSchema = z.object({
  category: z.enum(SALE_CATEGORIES, { message: "Odaberi kategoriju." }),
  item: z.string().min(1, "Opis je obavezan."),
  buyerName: z.string().optional(),
  priceEur: z.coerce.number().int().min(0, "Iznos ne smije biti negativan."),
  date: z.string().regex(DATE_RE, "Datum nije ispravan."),
  note: z.string().optional(),
});

export async function createSaleAction(
  redirectTo: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = SaleSchema.safeParse({
    category: formData.get("category"),
    item: formData.get("item"),
    buyerName: formData.get("buyerName"),
    priceEur: formData.get("priceEur"),
    date: formData.get("date"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }

  await createSale({
    category: parsed.data.category,
    item: parsed.data.item,
    buyerName: parsed.data.buyerName || null,
    priceEur: parsed.data.priceEur,
    date: parsed.data.date,
    note: parsed.data.note || null,
  });
  revalidatePath("/admin/prodaja");
  // redirect() umjesto { success: true } — isprazni formu za sljedeći unos.
  redirect(redirectTo);
}

export async function deleteSaleAction(id: number) {
  await requireAdmin();
  await deleteSale(id);
  revalidatePath("/admin/prodaja");
}
