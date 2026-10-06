"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { dateStringOffsetFromTodayZagreb, todayDateStringZagreb } from "@/lib/date";
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
  createDiscountCode,
  setDiscountCodeActive,
  deleteDiscountCode,
  findValidDiscountCode,
  incrementDiscountCodeUse,
  getOrCreateReferralCode,
  setReferralPercent,
  normalizeCode,
} from "@/lib/db/queries";
import {
  findAdminByEmail,
  getReservationById,
  getExpenseById,
  updateReservation,
  getLoginLockMinutesLeft,
  registerFailedLogin,
  clearFailedLogins,
  LOGIN_LOCK_MINUTES,
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
  isProductSlugTaken,
  createInquiry,
  countRecentInquiriesByIp,
  getInquiryById,
  markInquiryRead,
  markInquiryReplied,
  deleteInquiry,
  getAdminById,
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
  ensurePushSubscriptionsTable,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  extendSubscription,
  updateAdminLoginStreak,
  updateOwnerTheme,
  updateOwnerCustomGoal,
  isNfcSlugTaken,
  createNfcTag,
  updateNfcTag,
  deleteNfcTag,
  createTeamTask,
  updateTeamTaskStatus,
  assignTeamTask,
  deleteTeamTask,
  createTaskTemplate,
  deleteTaskTemplate,
  createTeamMessage,
  toggleTeamMessageReaction,
  toggleTeamMessagePin,
  updateAdminLastSeen,
  createDirectMessage,
  markDirectMessagesRead,
  updateAdminProfile,
  updateAdminStatus,
} from "@/lib/db/queries";
import { sendInquiryNotification, sendGuestConfirmation, sendReservationConfirmation, sendInquiryReply } from "@/lib/email";
import { resolveCoordinates, geoMissWarning } from "@/lib/geocode";
import { sendPushToAdmins, sendPushToAllDevices } from "@/lib/push";
import type { AdminUser, Inquiry } from "@/lib/db/schema";

export type ActionState =
  | { error?: string; success?: boolean; warning?: string; referralCode?: string; referralPercent?: number }
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
  "nfc", // /nfc/[slug] — gost-facing WiFi stranice za NFC pločice, vidi lib/db/schema.ts nfcTags
  "proizvodi", // /proizvodi i /proizvodi/[slug] — javne stranice proizvoda, vidi lib/db/schema.ts products
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

  // Zaključavanje nakon previše krivih pokušaja (plan #5) — štiti od
  // pogađanja lozinke. Provjerava se PRIJE bcrypt usporedbe.
  const lockedMinutes = await getLoginLockMinutesLeft(admin.id);
  if (lockedMinutes > 0) {
    return { error: `Previše neuspjelih pokušaja. Pokušaj ponovno za ${lockedMinutes} min.` };
  }

  const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!valid) {
    const { locked } = await registerFailedLogin(admin.id);
    return {
      error: locked
        ? `Previše neuspjelih pokušaja — račun je zaključan ${LOGIN_LOCK_MINUTES} min.`
        : "Pogrešan email ili lozinka.",
    };
  }

  if (admin.twoFactorEnabled) {
    // Lozinka je točna, ali puna sesija se NE stvara dok admin ne potvrdi
    // TOTP kod — vidi verifyTwoFactorLoginAction i lib/auth.ts "pending 2FA".
    // Lozinka točna — brojač krivih pokušaja se NE resetira dok 2FA kod
    // ne prođe, inače bi napadač s lozinkom mogao beskonačno pogađati kod.
    const pendingToken = await createPendingTwoFactorToken(admin.id);
    await setPendingTwoFactorCookie(pendingToken);
    redirect("/admin/login/2fa");
  }

  await clearFailedLogins(admin.id);
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

  const lockedMinutes = await getLoginLockMinutesLeft(admin.id);
  if (lockedMinutes > 0) {
    await clearPendingTwoFactorCookie();
    return { error: `Previše neuspjelih pokušaja. Pokušaj ponovno za ${lockedMinutes} min.` };
  }

  const totp = buildTotp(admin.email, Secret.fromBase32(admin.twoFactorSecret));
  const delta = totp.validate({ token: parsed.data.code, window: 1 });
  if (delta === null) {
    const { locked } = await registerFailedLogin(admin.id);
    if (locked) {
      await clearPendingTwoFactorCookie();
      return { error: `Previše neuspjelih pokušaja — račun je zaključan ${LOGIN_LOCK_MINUTES} min.` };
    }
    return { error: "Kod nije ispravan ili je istekao." };
  }

  await clearFailedLogins(admin.id);
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
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9 ()/-]{6,25}$/.test(v), "Telefon smije sadržavati samo brojke, razmake i +."),
  metaPixelId: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{6,20}$/.test(v), "Meta Pixel ID je niz brojki (npr. 1234567890123456)."),
  gaMeasurementId: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^G-[A-Z0-9]{4,15}$/.test(v), "Google Analytics ID izgleda kao G-ABC123XYZ."),
  deliveryText: z.string().trim().max(200),
  productionText: z.string().trim().max(200),
  guaranteeText: z.string().trim().max(200),
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
    phone: formData.get("phone") ?? "",
    metaPixelId: formData.get("metaPixelId") ?? "",
    gaMeasurementId: formData.get("gaMeasurementId") ?? "",
    deliveryText: formData.get("deliveryText") ?? "",
    productionText: formData.get("productionText") ?? "",
    guaranteeText: formData.get("guaranteeText") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  await updateAgency({
    ...parsed.data,
    phone: emptyToNull(parsed.data.phone),
    metaPixelId: emptyToNull(parsed.data.metaPixelId),
    gaMeasurementId: emptyToNull(parsed.data.gaMeasurementId),
    deliveryText: emptyToNull(parsed.data.deliveryText),
    productionText: emptyToNull(parsed.data.productionText),
    guaranteeText: emptyToNull(parsed.data.guaranteeText),
  });
  revalidatePath("/");
  revalidatePath("/proizvodi", "layout");
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
  layoutStyle: z.enum(["classic", "editorial", "raw", "apple", "grand"]).default("classic"),
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
  logoUrl: z.string().optional(),
  showNovoBranding: z.coerce.boolean(),
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
    logoUrl: formData.get("logoUrl") ?? "",
    showNovoBranding: formData.get("showNovoBranding") === "on",
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
      logoUrl: parsed.data.logoUrl?.trim() || null,
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
    logoUrl: formData.get("logoUrl") ?? "",
    showNovoBranding: formData.get("showNovoBranding") === "on",
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
      logoUrl: parsed.data.logoUrl?.trim() || null,
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
  layoutStyle: z.enum(["classic", "editorial", "raw", "apple", "grand"]).default("classic"),
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
  logoUrl: z.string().optional(),
  showNovoBranding: z.coerce.boolean(),
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
    logoUrl: formData.get("logoUrl") ?? "",
    showNovoBranding: formData.get("showNovoBranding") === "on",
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
      logoUrl: parsed.data.logoUrl?.trim() || null,
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
      logoUrl: parsed.data.logoUrl?.trim() || null,
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
  /** Prazno = proizvod nema vlastitu /proizvodi/<slug> stranicu (nije link,
      ne pojavljuje se u /proizvodi popisu). */
  slug: z
    .string()
    .optional()
    .refine((v) => !v || /^[a-z0-9-]+$/.test(v), "Slug smije sadržavati samo mala slova, brojke i crtice."),
  videoUrl: z.string().optional(),
  category: z.string().optional(),
  featured: z.coerce.boolean(),
  ctaButtonText: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  faq: z.string().optional(), // JSON niz {question, answer}
  testimonials: z.string().optional(), // JSON niz {author, text, rating}
  quantityDiscounts: z.string().optional(), // JSON niz {minQty, percent}
  addonProductIds: z.string().optional(), // JSON niz id-jeva
  addonDiscountPercent: z.coerce.number().int().min(0).max(90).default(0),
  salePercent: z.coerce.number().int().min(0, "Akcija mora biti 0–90 %.").max(90, "Akcija mora biti 0–90 %.").default(0),
  saleEndsAt: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Datum kraja akcije nije ispravan."),
  showNfcPreview: z.coerce.boolean(),
});

function parseQuantityDiscounts(raw?: string): { minQty: number; percent: number }[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    if (!Array.isArray(arr)) return [];
    const seen = new Set<number>();
    return arr
      .map((t) => ({ minQty: Math.round(Number(t?.minQty)), percent: Math.round(Number(t?.percent)) }))
      .filter((t) => t.minQty >= 2 && t.minQty <= 999 && t.percent > 0 && t.percent <= 90)
      .filter((t) => (seen.has(t.minQty) ? false : (seen.add(t.minQty), true)))
      .sort((a, b) => a.minQty - b.minQty);
  } catch {
    return [];
  }
}

function parseIdList(raw?: string, excludeId?: number): number[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n !== excludeId))].slice(0, 6);
  } catch {
    return [];
  }
}

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
    slug: formData.get("slug") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    category: formData.get("category") ?? "",
    featured: formData.get("featured") === "on",
    ctaButtonText: formData.get("ctaButtonText") ?? "",
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
    faq: formData.get("faq") ?? "[]",
    testimonials: formData.get("testimonials") ?? "[]",
    quantityDiscounts: formData.get("quantityDiscounts") ?? "[]",
    addonProductIds: formData.get("addonProductIds") ?? "[]",
    addonDiscountPercent: formData.get("addonDiscountPercent") || "0",
    salePercent: formData.get("salePercent") || "0",
    saleEndsAt: formData.get("saleEndsAt") ?? "",
    showNfcPreview: formData.get("showNfcPreview") === "on",
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
  const slug = emptyToNull(parsed.data.slug);
  if (slug) {
    if (RESERVED_SLUGS.has(slug)) {
      return { error: `"${slug}" je rezervirana adresa, odaberi drugu.` };
    }
    if (await isProductSlugTaken(slug)) {
      return { error: `Adresa "${slug}" je već zauzeta — odaberi drugu.` };
    }
  }
  await createProduct({
    ...parsed.data,
    priceEur: parsePriceEur(parsed.data.priceEur),
    images: parseImages(parsed.data.images),
    features: parseAmenities(parsed.data.features ?? ""),
    slug,
    videoUrl: emptyToNull(parsed.data.videoUrl),
    category: emptyToNull(parsed.data.category),
    ctaButtonText: emptyToNull(parsed.data.ctaButtonText),
    seoTitle: emptyToNull(parsed.data.seoTitle),
    seoDescription: emptyToNull(parsed.data.seoDescription),
    faq: parseFaq(parsed.data.faq),
    testimonials: parseTestimonials(parsed.data.testimonials),
    quantityDiscounts: parseQuantityDiscounts(parsed.data.quantityDiscounts),
    addonProductIds: parseIdList(parsed.data.addonProductIds),
    saleEndsAt: emptyToNull(parsed.data.saleEndsAt),
  });
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/proizvodi");
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
  const slug = emptyToNull(parsed.data.slug);
  if (slug) {
    if (RESERVED_SLUGS.has(slug)) {
      return { error: `"${slug}" je rezervirana adresa, odaberi drugu.` };
    }
    if (await isProductSlugTaken(slug, id)) {
      return { error: `Adresa "${slug}" je već zauzeta — odaberi drugu.` };
    }
  }
  await updateProduct(id, {
    ...parsed.data,
    priceEur: parsePriceEur(parsed.data.priceEur),
    images: parseImages(parsed.data.images),
    features: parseAmenities(parsed.data.features ?? ""),
    slug,
    videoUrl: emptyToNull(parsed.data.videoUrl),
    category: emptyToNull(parsed.data.category),
    ctaButtonText: emptyToNull(parsed.data.ctaButtonText),
    seoTitle: emptyToNull(parsed.data.seoTitle),
    seoDescription: emptyToNull(parsed.data.seoDescription),
    faq: parseFaq(parsed.data.faq),
    testimonials: parseTestimonials(parsed.data.testimonials),
    quantityDiscounts: parseQuantityDiscounts(parsed.data.quantityDiscounts),
    addonProductIds: parseIdList(parsed.data.addonProductIds, id),
    saleEndsAt: emptyToNull(parsed.data.saleEndsAt),
  });
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/proizvodi");
  if (slug) revalidatePath(`/proizvodi/${slug}`);
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
/* NFC oznake (gost-facing WiFi stranica, vidi lib/db/schema.ts       */
/* nfcTags i app/nfc/[slug]/page.tsx) — vlastiti /nfc/<slug> namespace */
/* pa slug provjera ide preko isNfcSlugTaken, NE isSlugTaken.          */
/* ---------------------------------------------------------------- */

const NfcTagSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug je obavezan.")
    .regex(/^[a-z0-9-]+$/, "Slug smije sadržavati samo mala slova, brojke i crtice."),
  label: z.string().min(1, "Interna oznaka je obavezna."),
  wifiSsid: z.string().min(1, "Naziv WiFi mreže je obavezan."),
  wifiPassword: z.string().optional(),
  welcomeTitle: z.string().optional(),
  welcomeText: z.string().optional(),
  image: z.string().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Boja mora biti u obliku #RRGGBB.")
    .default("#B5502E"),
  published: z.coerce.boolean(),
  googleReviewUrl: z.string().optional(),
  socialUrl: z.string().optional(),
  contactPhone: z.string().optional(),
  houseRulesText: z.string().optional(),
  localTipsText: z.string().optional(),
});

function readNfcTagFormData(formData: FormData) {
  return {
    slug: formData.get("slug"),
    label: formData.get("label"),
    wifiSsid: formData.get("wifiSsid"),
    wifiPassword: formData.get("wifiPassword") ?? "",
    welcomeTitle: formData.get("welcomeTitle") ?? "",
    welcomeText: formData.get("welcomeText") ?? "",
    image: formData.get("image") ?? "",
    accentColor: formData.get("accentColor") || "#B5502E",
    published: formData.get("published") === "on",
    googleReviewUrl: formData.get("googleReviewUrl") ?? "",
    socialUrl: formData.get("socialUrl") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    houseRulesText: formData.get("houseRulesText") ?? "",
    localTipsText: formData.get("localTipsText") ?? "",
  };
}

/** Prazan string → null (za sva opcionalna text polja: wifiPassword znači
    "otvorena mreža bez lozinke" kad je null, ostala znače "ne prikazuje se"). */
function emptyToNull(v?: string): string | null {
  const trimmed = (v ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export async function createNfcTagAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = NfcTagSchema.safeParse(readNfcTagFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  if (RESERVED_SLUGS.has(parsed.data.slug)) {
    return { error: `"${parsed.data.slug}" je rezervirana adresa, odaberi drugu.` };
  }
  if (await isNfcSlugTaken(parsed.data.slug)) {
    return { error: `Adresa "${parsed.data.slug}" je već zauzeta — odaberi drugu.` };
  }
  await createNfcTag({
    slug: parsed.data.slug,
    label: parsed.data.label,
    wifiSsid: parsed.data.wifiSsid,
    wifiPassword: emptyToNull(parsed.data.wifiPassword),
    welcomeTitle: emptyToNull(parsed.data.welcomeTitle),
    welcomeText: emptyToNull(parsed.data.welcomeText),
    image: emptyToNull(parsed.data.image),
    accentColor: parsed.data.accentColor,
    published: parsed.data.published,
    googleReviewUrl: emptyToNull(parsed.data.googleReviewUrl),
    socialUrl: emptyToNull(parsed.data.socialUrl),
    contactPhone: emptyToNull(parsed.data.contactPhone),
    houseRulesText: emptyToNull(parsed.data.houseRulesText),
    localTipsText: emptyToNull(parsed.data.localTipsText),
  });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateNfcTagAction(
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = NfcTagSchema.safeParse(readNfcTagFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  if (RESERVED_SLUGS.has(parsed.data.slug)) {
    return { error: `"${parsed.data.slug}" je rezervirana adresa, odaberi drugu.` };
  }
  if (await isNfcSlugTaken(parsed.data.slug, id)) {
    return { error: `Adresa "${parsed.data.slug}" je već zauzeta — odaberi drugu.` };
  }
  await updateNfcTag(id, {
    slug: parsed.data.slug,
    label: parsed.data.label,
    wifiSsid: parsed.data.wifiSsid,
    wifiPassword: emptyToNull(parsed.data.wifiPassword),
    welcomeTitle: emptyToNull(parsed.data.welcomeTitle),
    welcomeText: emptyToNull(parsed.data.welcomeText),
    image: emptyToNull(parsed.data.image),
    accentColor: parsed.data.accentColor,
    published: parsed.data.published,
    googleReviewUrl: emptyToNull(parsed.data.googleReviewUrl),
    socialUrl: emptyToNull(parsed.data.socialUrl),
    contactPhone: emptyToNull(parsed.data.contactPhone),
    houseRulesText: emptyToNull(parsed.data.houseRulesText),
    localTipsText: emptyToNull(parsed.data.localTipsText),
  });
  revalidatePath("/admin");
  revalidatePath(`/nfc/${parsed.data.slug}`);
  return { success: true };
}

export async function deleteNfcTagAction(id: number) {
  await requireAdmin();
  await deleteNfcTag(id);
  revalidatePath("/admin");
  redirect("/admin");
}

/* ---------------------------------------------------------------- */
/* Upiti (javni obrazac na stranici vikendice/firme/agencije)        */
/* ---------------------------------------------------------------- */

const InquirySchema = z.object({
  source: z.enum(["property", "company", "agency", "product"]),
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

  // Izvor posjeta (utm parametri oglasa, referrer) — šalje ga obrazac na
  // stranici proizvoda (ProductInquiryNovo). Dodaje se na kraj poruke da se
  // u /admin/inquiries i u e-mail obavijesti vidi s kojeg je oglasa upit.
  const attribution = String(formData.get("attribution") ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 300);
  // Kod za popust — provjerava se ovdje na serveru (ne vjerujemo pregledniku).
  const rawCode = String(formData.get("discountCode") ?? "");
  const usedCode = rawCode ? await findValidDiscountCode(rawCode, todayDateStringZagreb()).catch(() => null) : null;
  const codeLine = usedCode
    ? `Kod za popust: ${usedCode.code} (−${usedCode.percent} %)` +
      (usedCode.referrerEmail ? ` — preporuka od ${usedCode.referrerName || ""} <${usedCode.referrerEmail}>` : "")
    : rawCode.trim()
      ? `Kod za popust: ${normalizeCode(rawCode)} (NIJE VAŽEĆI)`
      : "";
  const baseMessage = [parsed.data.message.trim(), codeLine].filter(Boolean).join("\n");
  const message = attribution ? `${baseMessage}\n\n— Izvor: ${attribution}` : baseMessage;

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
      message,
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
        message,
      });
    }
  } catch (err) {
    // Ne rušimo odgovor korisniku (upit je već spremljen iznad), ali
    // logiramo grešku da je vidimo u Vercel Runtime Logs radi dijagnostike.
    console.error("[createInquiryAction] slanje email obavijesti nije uspjelo:", err);
  }

  // Push obavijest ("Novi upit stigne" iz zahtjeva) — sendPushToAdmins sam
  // po sebi nikad ne baca grešku, ne treba try/catch. Za agencijski upit
  // (bez konkretne vikendice/firme) idu samo puni admini, vlasnici ionako
  // takve upite ne vide.
  await sendPushToAdmins(
    parsed.data.source === "property" && sourceId
      ? { propertyId: sourceId }
      : parsed.data.source === "company" && sourceId
        ? { companyId: sourceId }
        : {},
    {
      title: "Novi upit",
      body: `${parsed.data.name.trim()} — ${parsed.data.sourceName.trim()}`,
      url: "/admin/inquiries",
    }
  );

  if (usedCode) {
    await incrementDiscountCodeUse(usedCode.id).catch((err) =>
      console.error("[createInquiryAction] brojač koda nije ažuriran:", err)
    );
  }

  // Osobni kod za preporuku (samo za upite za proizvode, ako je uključeno u adminu).
  let referral: { code: string; percent: number } | null = null;
  let productionText: string | null = null;
  if (parsed.data.source === "product") {
    try {
      const agencyRow = await getAgency();
      productionText = agencyRow?.productionText ?? null;
      const pct = agencyRow?.referralPercent ?? 0;
      if (pct > 0) {
        const row = await getOrCreateReferralCode(parsed.data.name, parsed.data.email, pct);
        if (row) referral = { code: row.code, percent: row.percent };
      }
    } catch (err) {
      console.error("[createInquiryAction] kod za preporuku nije napravljen:", err);
    }
  }

  try {
    await sendGuestConfirmation({
      to: parsed.data.email.trim(),
      sourceName: parsed.data.sourceName.trim(),
      name: parsed.data.name.trim(),
      ...(parsed.data.source === "product"
        ? {
            summary: baseMessage,
            productionText,
            referral,
            pageUrl: String(formData.get("pageUrl") ?? "").slice(0, 300) || null,
          }
        : {}),
    });
  } catch (err) {
    console.error("[createInquiryAction] slanje potvrde gostu nije uspjelo:", err);
  }

  revalidatePath("/admin/inquiries");
  return referral
    ? { success: true, referralCode: referral.code, referralPercent: referral.percent }
    : { success: true };
}

/** Provjera koda za popust iz obrasca (prije slanja) — vraća samo postotak. */
export async function checkDiscountCodeAction(
  code: string
): Promise<{ code: string; percent: number } | { error: string }> {
  const row = await findValidDiscountCode(String(code ?? ""), todayDateStringZagreb()).catch(() => null);
  if (!row) return { error: "Kod nije važeći ili je istekao." };
  return { code: row.code, percent: row.percent };
}

/* ---------------------------------------------------------------- */
/* Popusti (admin)                                                    */
/* ---------------------------------------------------------------- */

const DiscountCodeSchema = z.object({
  code: z
    .string()
    .transform((v) => normalizeCode(v))
    .refine((v) => v.length >= 3, "Kod mora imati barem 3 znaka (slova, brojke, crtica)."),
  percent: z.coerce.number().int().min(1, "Popust mora biti 1–90 %.").max(90, "Popust mora biti 1–90 %."),
  expiresAt: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Datum isteka nije ispravan."),
  maxUses: z.string().optional(),
  note: z.string().max(200).optional(),
});

export async function createDiscountCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = DiscountCodeSchema.safeParse({
    code: formData.get("code") ?? "",
    percent: formData.get("percent") ?? "",
    expiresAt: formData.get("expiresAt") ?? "",
    maxUses: formData.get("maxUses") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  const maxUses = parsed.data.maxUses ? Math.max(1, Math.round(Number(parsed.data.maxUses)) || 1) : null;
  try {
    await createDiscountCode({
      code: parsed.data.code,
      percent: parsed.data.percent,
      expiresAt: emptyToNull(parsed.data.expiresAt),
      maxUses,
      note: emptyToNull(parsed.data.note),
    });
  } catch {
    return { error: `Kod "${parsed.data.code}" već postoji.` };
  }
  revalidatePath("/admin/popusti");
  return { success: true };
}

export async function toggleDiscountCodeAction(id: number, active: boolean): Promise<void> {
  await requireAdmin();
  await setDiscountCodeActive(id, active);
  revalidatePath("/admin/popusti");
}

export async function deleteDiscountCodeAction(id: number): Promise<void> {
  await requireAdmin();
  await deleteDiscountCode(id);
  revalidatePath("/admin/popusti");
}

export async function updateReferralPercentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const n = Math.round(Number(formData.get("referralPercent") ?? 0));
  if (!Number.isFinite(n) || n < 0 || n > 50) return { error: "Popust za preporuku mora biti 0–50 %." };
  await setReferralPercent(n);
  revalidatePath("/admin/popusti");
  return { success: true };
}

/** Kontakt-email vikendice/firme na koji ide obavijest o novom upitu; pada
    natrag na agencijski email ako specifičan nije postavljen (isti lanac
    fallbackova kao za "Pošaljite upit" mailto gumbe na /[slug] stranici). */
async function resolveInquiryRecipient(
  source: "property" | "company" | "agency" | "product",
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
  // "agency" i "product" nemaju vlastiti kontakt-email — upit ide na
  // agencijski (isti obrazac kao "agency" prije uvođenja proizvoda).
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
  // Za tjednu ljestvicu Portala (plan #70) i dnevnik aktivnosti.
  await logActivity({
    adminEmail: admin.email,
    action: "replied_inquiry",
    targetLabel: `${inquiry.name} (${inquiry.sourceName})`,
    propertyId: inquiry.source === "property" ? inquiry.sourceId : null,
  });
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

  // Push obavijest ("Nova rezervacija od drugog admina" iz zahtjeva) —
  // excludeAdminId izostavlja admina koji je BAŠ SAD unio ovu rezervaciju,
  // ne treba obavijestiti samog sebe o vlastitoj akciji.
  await sendPushToAdmins(
    { propertyId },
    {
      title: "Nova rezervacija",
      body: `${parsed.data.guestName} — ${property?.name ?? ""} (${parsed.data.checkIn} → ${parsed.data.checkOut})`,
      url: "/admin/rezervacije",
    },
    { excludeAdminId: admin.id }
  );

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

/** Rezervacija mora stvarno pripadati vikendici za koju je provjeren
    pristup — inače bi vlasnik mogao poslati tuđi id uz svoj propertyId. */
async function assertReservationInProperty(id: number, propertyId: number) {
  const r = await getReservationById(id);
  if (!r || r.propertyId !== propertyId) redirect("/admin/rezervacije");
  return r;
}

const ReservationUpdateSchema = ReservationSchema.omit({ paid: true });

/** Uređivanje postojeće rezervacije (plan #36) — vidi updateReservation. */
export async function updateReservationAction(
  propertyId: number,
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);
  await assertReservationInProperty(id, propertyId);

  const parsed = ReservationUpdateSchema.safeParse({
    guestName: formData.get("guestName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    priceEur: formData.get("priceEur"),
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

  const { overlappingDates } = await updateReservation(id, {
    guestName: parsed.data.guestName,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    checkIn: parsed.data.checkIn,
    checkOut: parsed.data.checkOut,
    priceEur: parsed.data.priceEur,
    guestCount: parsed.data.guestCount ?? null,
    depositEur: parsed.data.depositEur ?? null,
    note: parsed.data.note || null,
  });
  await logActivity({
    adminEmail: admin.email,
    action: "updated_reservation",
    targetLabel: `${parsed.data.guestName} (${parsed.data.checkIn} → ${parsed.data.checkOut})`,
    propertyId,
  });

  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin/kalendar");
  revalidatePath("/admin");
  revalidatePath("/admin/vikendice");
  if (overlappingDates.length > 0) {
    return {
      success: true,
      warning: `Spremljeno, ali ${overlappingDates.length} ${overlappingDates.length === 1 ? "dan je" : "dana je"} već bilo zauzeto — provjeri kalendar.`,
    };
  }
  return { success: true };
}

export async function deleteReservationAction(propertyId: number, id: number, guestName: string) {
  const admin = await requireAdminOrOwner();
  await assertPropertyAccess(admin, propertyId);
  await assertReservationInProperty(id, propertyId);
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
  await assertReservationInProperty(id, propertyId);
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
  await assertReservationInProperty(id, propertyId);
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
  const expense = await getExpenseById(id);
  if (!expense || expense.propertyId !== propertyId) redirect("/admin/rezervacije");
  await deleteExpense(id);
  await logActivity({ adminEmail: admin.email, action: "deleted_expense", targetLabel: description, propertyId });
  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin");
}

/* ---------------------------------------------------------------- */
/* Zarada agencije (prodaja stranica/proizvoda/usluga) — vidi         */
/* app/admin/financije (spojeno s pretplatama, bivši /admin/prodaja). */
/* Samo GLAVNI admin/superadmini (requireSuperAdmin) — isto pravilo   */
/* kao pretplate, otkad je korisnik izričito potvrdio "financije i    */
/* prodaja su oboje za superadmine"; pooštreno s prijašnjeg           */
/* requireAdmin (koji je puštao SVE pune admine, ne samo glavnog).    */
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
  await requireSuperAdmin();

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
  revalidatePath("/admin/financije");
  // redirect() umjesto { success: true } — isprazni formu za sljedeći unos.
  redirect(redirectTo);
}

export async function deleteSaleAction(id: number) {
  await requireSuperAdmin();
  await deleteSale(id);
  revalidatePath("/admin/financije");
}

/* ---------------------------------------------------------------- */
/* Broadcast push obavijest — /admin/settings, SAMO superadmin        */
/* (requireSuperAdmin). Šalje se BAŠ SVAKOM pretplaćenom     */
/* uređaju svih admina (uključujući vlasnike), vidi lib/push.ts        */
/* sendPushToAllDevices.                                              */
/* ---------------------------------------------------------------- */

export type BroadcastPushState =
  | { error?: string; success?: boolean; sent?: number; failed?: number }
  | undefined;

const BroadcastPushSchema = z.object({
  title: z.string().trim().min(1, { message: "Unesi naslov." }).max(80),
  body: z.string().trim().min(1, { message: "Unesi poruku." }).max(500),
});

export async function sendBroadcastPushAction(
  _prevState: BroadcastPushState,
  formData: FormData
): Promise<BroadcastPushState> {
  // Plan #6: obavijest ide na SVE uređaje (i vlasnicima) — smije samo superadmin.
  await requireSuperAdmin();

  const parsed = BroadcastPushSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }

  try {
    const { sent, failed } = await sendPushToAllDevices({
      title: parsed.data.title,
      body: parsed.data.body,
      url: "/admin",
    });
    if (sent === 0 && failed === 0) {
      return { error: "Nijedan uređaj još nema uključene obavijesti." };
    }
    return { success: true, sent, failed };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Slanje nije uspjelo." };
  }
}

/* ---------------------------------------------------------------- */
/* Jednokratni "popravi bazu" gumb — /admin/settings, ako             */
/* push_subscriptions tablica slučajno ne postoji (SQL migracija nije  */
/* ručno pokrenuta). Sigurno je kliknuti i kad tablica već postoji     */
/* (CREATE TABLE IF NOT EXISTS, vidi ensurePushSubscriptionsTable).    */
/* ---------------------------------------------------------------- */

export type RunPushMigrationState = { error?: string; success?: boolean } | undefined;

// useActionState traži oblik (state, payload) — ovaj gumb ne treba ni jedno ni drugo.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function runPushMigrationAction(
  _prevState: RunPushMigrationState,
  _formData: FormData
): Promise<RunPushMigrationState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  await requireAdmin();
  try {
    await ensurePushSubscriptionsTable();
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nije uspjelo." };
  }
}

/* ---------------------------------------------------------------- */
/* Pretplate NOVO studija (Financije) — samo glavni admin/superadmini,  */
/* vidi lib/auth.ts requireSuperAdmin i lib/db/schema.ts subscriptions. */
/* Potpuno odvojeno od Prodaja (jednokratna zarada agencije) i od       */
/* Rezervacije/Troškovi (zarada VIKENDICE za vlasnika). */
/* ---------------------------------------------------------------- */

const SubscriptionSchema = z.object({
  source: z.enum(["property", "company"]),
  sourceId: z.coerce.number().int().positive("Odaberi vikendicu ili firmu."),
  monthlyPriceEur: z.coerce.number().int().min(0),
  startDate: z.string().min(1, "Datum starta je obavezan."),
  isTrial: z.coerce.boolean(),
  trialEndsAt: z.string().optional(),
  status: z.enum(["active", "trial", "paused", "cancelled"]),
  nextRenewalDate: z.string().min(1, "Datum sljedeće naplate je obavezan."),
  note: z.string().optional(),
});

async function resolveSubscriptionSourceName(
  source: "property" | "company",
  sourceId: number
): Promise<string | null> {
  if (source === "property") {
    const p = await getPropertyById(sourceId);
    return p?.name ?? null;
  }
  const c = await getCompanyById(sourceId);
  return c?.name ?? null;
}

function parseSubscriptionForm(formData: FormData) {
  return SubscriptionSchema.safeParse({
    source: formData.get("source"),
    sourceId: formData.get("sourceId"),
    monthlyPriceEur: formData.get("monthlyPriceEur"),
    startDate: formData.get("startDate"),
    isTrial: formData.get("isTrial") === "on",
    trialEndsAt: formData.get("trialEndsAt") || undefined,
    status: formData.get("status"),
    nextRenewalDate: formData.get("nextRenewalDate"),
    note: formData.get("note") || undefined,
  });
}

export async function createSubscriptionAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = parseSubscriptionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  const sourceName = await resolveSubscriptionSourceName(parsed.data.source, parsed.data.sourceId);
  if (!sourceName) {
    return { error: "Odabrana vikendica/firma ne postoji." };
  }
  await createSubscription({
    ...parsed.data,
    sourceName,
    trialEndsAt: parsed.data.trialEndsAt ?? null,
    note: parsed.data.note ?? null,
  });
  revalidatePath("/admin/financije");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateSubscriptionAction(
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = parseSubscriptionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  const sourceName = await resolveSubscriptionSourceName(parsed.data.source, parsed.data.sourceId);
  if (!sourceName) {
    return { error: "Odabrana vikendica/firma ne postoji." };
  }
  await updateSubscription(id, {
    ...parsed.data,
    sourceName,
    trialEndsAt: parsed.data.trialEndsAt ?? null,
    note: parsed.data.note ?? null,
  });
  revalidatePath("/admin/financije");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteSubscriptionAction(id: number) {
  await requireSuperAdmin();
  await deleteSubscription(id);
  revalidatePath("/admin/financije");
  revalidatePath("/admin");
}

/** "Produži" brzi gumb u tablici — pomakne nextRenewalDate za `months`
 * mjeseci (vidi extendSubscription u lib/db/queries.ts: računa od danas ako
 * je datum već prošao, inače od trenutnog nextRenewalDate), skida trial i
 * resetira reminderSentAt da idući ciklus opet dobije podsjetnik. */
export async function extendSubscriptionAction(id: number, months: number) {
  await requireSuperAdmin();
  await extendSubscription(id, months);
  revalidatePath("/admin/financije");
  revalidatePath("/admin");
}

/**
 * Ažurira Duolingo-stil streak (vidi lib/db/queries.ts updateAdminLoginStreak)
 * — namjerno POZVANO IZ KLIJENTA (components/admin/OwnerHero.tsx useEffect
 * nakon mounta), ne tijekom renderiranja app/admin/page.tsx OwnerDashboard.
 * Server Komponente se u Next.js-u znaju renderirati više puta po zahtjevu
 * (RSC payload + prefetch), pa je pisanje u bazu ("bump" streaka) usred
 * renderiranja nepouzdano — dvije izvedbe iste stranice mogu vidjeti
 * RAZLIČITO stanje baze i proizvesti različit HTML, što je uzrokovalo
 * povremenu React hydration grešku (#418) na /admin za vlasnika. Sada
 * OwnerDashboard samo ČITA početni streak (admin.loginStreakCount, bez
 * pisanja) za prvi render, a stvarni "bump" se događa ovdje, ČISTO na
 * klijentu nakon što je stranica već hidrirana — nema više utrke između
 * dva izvršavanja render funkcije. Vraća najnovije stanje da OwnerHero
 * može animirano "podići" broj i prikazati konfeti tek kad je stvarno
 * potvrđeno da je streak porastao danas prvi put. */
export async function refreshOwnerLoginStreakAction(): Promise<{
  streak: number;
  isNewToday: boolean;
}> {
  const admin = await requireAdminOrOwner();
  return updateAdminLoginStreak(admin.id);
}

/** Sprema izbor teme (svijetla/tamna/prati sustav) za vlasnički dashboard
 * (components/admin/OwnerThemeToggle.tsx) — vezano uz admin_users retka pa
 * se prati preko uređaja/preglednika, ne samo localStorage. Čisti "use
 * client" event handler (klik na gumb), nikad se ne poziva iz render puta
 * Server Komponente — isti razlog kao refreshOwnerLoginStreakAction gore. */
export async function updateOwnerThemeAction(
  theme: "light" | "dark" | "system"
): Promise<void> {
  const admin = await requireAdminOrOwner();
  await updateOwnerTheme(admin.id, theme);
  revalidatePath("/admin");
}

/** Sprema vlasnikov ručni cilj dana zauzeća (components/admin/
 * OwnerGoalEditor.tsx) — `days` null briše ručni cilj (vraća se na auto-
 * izračun). Ograničeno na razuman raspon (1-31) da slučajan unos ne
 * pokvari prsten napretka na hero kartici. */
export async function updateOwnerGoalAction(days: number | null): Promise<void> {
  const admin = await requireAdminOrOwner();
  const clamped = days === null ? null : Math.min(31, Math.max(1, Math.round(days)));
  await updateOwnerCustomGoal(admin.id, clamped);
  revalidatePath("/admin");
}

/* ---------------------------------------------------------------- */
/* FAZA 2 — tim: zadaci + interni feed poruka (app/admin/zadaci,      */
/* app/admin/poruke). Dostupno SVIM punim adminima/superadminima      */
/* (requireAdmin), nikad vlasnicima — na izričit zahtjev: "svi puni   */
/* admini + superadmini vide zadatke i poruke". */
/* ---------------------------------------------------------------- */

const TeamTaskSchema = z.object({
  title: z.string().min(1, "Naslov je obavezan.").max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  assignedToEmail: z.string().email().optional().or(z.literal("")),
  /** "" | "property:<id>" | "company:<id>" — vidi TeamTaskForm, jedan
      <select> garantira da je najviše jedno od dvoje ikad postavljeno
      (umjesto dva neovisna polja koja bi mogla oba biti popunjena). */
  client: z.string().optional().or(z.literal("")),
  dueDate: z.string().regex(DATE_RE, "Datum nije ispravan.").optional().or(z.literal("")),
  /** Checkbox "Spremi kao predložak" (TeamTaskForm) — checkbox šalje "on"
      kad je označen, izostaje iz FormData kad nije (standardno HTML
      ponašanje), otud optional string umjesto booleana. */
  saveAsTemplate: z.string().optional(),
});

export async function createTeamTaskAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = TeamTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || "normal",
    assignedToEmail: formData.get("assignedToEmail") || "",
    client: formData.get("client") || "",
    dueDate: formData.get("dueDate") || "",
    saveAsTemplate: formData.get("saveAsTemplate") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }

  const [clientKind, clientIdStr] = (parsed.data.client || "").split(":");
  const propertyId = clientKind === "property" ? Number(clientIdStr) : null;
  const companyId = clientKind === "company" ? Number(clientIdStr) : null;

  await createTeamTask({
    title: parsed.data.title,
    description: parsed.data.description || null,
    priority: parsed.data.priority,
    assignedToEmail: parsed.data.assignedToEmail || null,
    createdByEmail: admin.email,
    propertyId: propertyId && !Number.isNaN(propertyId) ? propertyId : null,
    companyId: companyId && !Number.isNaN(companyId) ? companyId : null,
    dueDate: parsed.data.dueDate || null,
  });

  // "Spremi kao predložak" (task templates) — namjerno BEZ dueDate/klijenta/
  // dodjele, predložak nosi samo ono što se ponavlja iz zadatka u zadatak,
  // vidi opsežan komentar uz taskTemplates u lib/db/schema.ts.
  if (parsed.data.saveAsTemplate === "on") {
    await createTaskTemplate({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      createdByEmail: admin.email,
    });
  }

  revalidatePath("/admin/portal");
  redirect("/admin/portal");
}

/** Plan #28: upit jednim klikom postaje zadatak u Portalu — naslov s imenom
    gosta, opis s porukom i kontaktom, povezan s vikendicom/firmom upita.
    Upit se usput označi pročitanim. Samo puni admini (Portal je njihov). */
export async function createTaskFromInquiryAction(inquiryId: number) {
  const admin = await requireAdmin();
  const inquiry = await getInquiryById(inquiryId);
  if (!inquiry) redirect("/admin/inquiries");
  const contact = [inquiry.email, inquiry.phone].filter(Boolean).join(" · ");
  await createTeamTask({
    title: `Odgovoriti na upit: ${inquiry.name} (${inquiry.sourceName})`.slice(0, 200),
    description: `${inquiry.message}\n\nKontakt: ${contact}`,
    priority: "normal",
    assignedToEmail: admin.email,
    createdByEmail: admin.email,
    propertyId: inquiry.source === "property" ? inquiry.sourceId : null,
    companyId: inquiry.source === "company" ? inquiry.sourceId : null,
    dueDate: dateStringOffsetFromTodayZagreb(1),
  });
  await markInquiryRead(inquiryId);
  revalidatePath("/admin/portal");
  revalidatePath("/admin/inquiries");
  redirect("/admin/portal");
}

/** Brisanje predloška zadatka (Portal, "Zadaci" tab) — bound-action gumb uz
 * svaki chip u TeamTaskForm, isti obrazac kao deleteTeamTaskAction. */
export async function deleteTaskTemplateAction(id: number) {
  await requireAdmin();
  await deleteTaskTemplate(id);
  revalidatePath("/admin/portal");
}

/** status: "todo" | "in_progress" | "done" — jednostavan bound-action gumb
 * u Portalu (Faza 3, tab "Zadaci" — bivši app/admin/zadaci), bez potvrde,
 * radnja je lako reverzibilna. */
export async function updateTeamTaskStatusAction(id: number, status: string) {
  await requireAdmin();
  await updateTeamTaskStatus(id, status);
  revalidatePath("/admin/portal");
}

/** email "" iz <select> znači "nedodijeli" — pretvara se u null. */
export async function assignTeamTaskAction(id: number, formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("assignedToEmail") ?? "").trim();
  await assignTeamTask(id, email || null);
  revalidatePath("/admin/portal");
}

export async function deleteTeamTaskAction(id: number) {
  await requireAdmin();
  await deleteTeamTask(id);
  revalidatePath("/admin/portal");
}

const TeamMessageSchema = z.object({
  body: z.string().min(1, "Poruka ne smije biti prazna.").max(4000),
});

/** taskId "" (opći feed) ili broj (komentar ispod zadatka) — vidi
 * TeamMessageForm skriveno polje. redirectTo vraća na stranicu s koje je
 * forma poslana (glavni feed ili konkretan zadatak), isti obrazac čišćenja
 * forme kao ExpenseForm/ReservationForm (redirect umjesto { success }). */
export async function createTeamMessageAction(
  taskId: number | null,
  redirectTo: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = TeamMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unos." };
  }

  await createTeamMessage({ adminEmail: admin.email, body: parsed.data.body, taskId: taskId ?? null });
  revalidatePath("/admin/portal");
  redirect(redirectTo);
}

/** Isto kao createTeamMessageAction (opći feed, taskId null), ali BEZ
 * redirecta — koristi ga Portal tim kanal (components/admin/
 * TeamChannelThread.tsx), klijentska komponenta koja poruke šalje preko
 * useActionState i osvježava se vlastitim pollingom, ne punom navigacijom
 * stranice (Teams/Slack-stil "ostani u niti dok šalješ"). */
export async function createTeamChannelMessageInlineAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = TeamMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unos." };
  }

  await createTeamMessage({ adminEmail: admin.email, body: parsed.data.body, taskId: null });
  revalidatePath("/admin/portal");
  return { success: true };
}

/** Emoji reakcija na poruku u tim kanalu (Portal Faza 5) — direktan poziv iz
 * klijentske komponente (TeamChannelThread.tsx handleToggleReaction preko
 * startTransition), isti obrazac kao updateOwnerThemeAction, NE
 * useActionState/<form action> (previše reakcijskih gumba po poruci da bi
 * svaki imao svoju formu). Bez revalidatePath — TeamChannelThread se i onako
 * odmah ponovno pollira (refetchMessages) čim se ovo vrati, isto kao slanje
 * poruke. */
export async function toggleTeamMessageReactionAction(messageId: number, emoji: string): Promise<void> {
  const admin = await requireAdmin();
  await toggleTeamMessageReaction(messageId, admin.email, emoji);
}

/** Prikvači/otkvači poruku u općem tim kanalu (Portal Faza 5) — isti obrazac
 * direktnog poziva kao toggleTeamMessageReactionAction iznad. */
export async function toggleTeamMessagePinAction(messageId: number): Promise<void> {
  const admin = await requireAdmin();
  await toggleTeamMessagePin(messageId, admin.email);
}

/** "Otkucaj" prisutnosti za "Ured" prikaz (components/admin/
 * PresenceHeartbeat.tsx, poziva se svake minute dok je puni admin negdje u
 * adminu — NE samo na /admin/poruke, da status prati stvarnu aktivnost).
 * Namjerno BEZ revalidatePath — vidi app/api/admin/presence koji ovo čita
 * kratkim pollingom umjesto pune revalidacije stranice svih otvorenih
 * tabova tima. Ne baca ako admin sesija istekne usred pozadinskog poziva. */
export async function heartbeatAction(): Promise<void> {
  const session = await getCurrentAdmin();
  if (!session) return;
  await updateAdminLastSeen(session.adminId);
}

/* ---------------------------------------------------------------- */
/* Portal (Faza 3) — direktno dopisivanje + profil, isti requireAdmin */
/* gate kao Faza 2 iznad (nikad vlasnicima). */
/* ---------------------------------------------------------------- */

const DirectMessageSchema = z.object({
  body: z.string().min(1, "Poruka ne smije biti prazna.").max(4000),
});

/** to = email primatelja (mora biti član tima, provjereno u pozivatelju
 * preko poznatog popisa — ovdje se ne provjerava dodatno jer requireAdmin
 * već jamči da je pošiljatelj punopravni admin, a slanje "nepostojećem"
 * emailu samo ostaje viseća poruka koju nitko ne vidi, bez sigurnosnog
 * rizika). Bez redirecta (za razliku od createTeamMessageAction) — poziva
 * se iz DmThread.tsx klijentske komponente preko fetch/useActionState, ne
 * iz obične <form> objave cijele stranice. */
export async function createDirectMessageAction(
  to: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = DirectMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unos." };
  }

  await createDirectMessage({ fromEmail: admin.email, toEmail: to, body: parsed.data.body });
  revalidatePath(`/admin/portal/dm/${encodeURIComponent(to)}`);
  revalidatePath("/admin/portal");
  return { success: true };
}

/** Poziva se pri otvaranju niti (app/admin/portal/dm/[email]/page.tsx) da
 * označi primljene poruke pročitanima — obična async funkcija, ne bound
 * server action (nema forme/gumba, samo nuzučinak pri renderu stranice). */
export async function markDirectMessagesReadAction(otherEmail: string): Promise<void> {
  const admin = await requireAdmin();
  await markDirectMessagesRead(admin.email, otherEmail);
}

const ProfileSchema = z.object({
  displayName: z.string().max(80).optional().or(z.literal("")),
  jobTitle: z.string().max(80).optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
  // Dolaze kao dva odvojena <select> polja (dan/mjesec, AdminProfileForm) —
  // spajaju se u "MM-DD" ispod. Vidi komentar uz adminUsers.birthday u
  // schema.ts (namjerno bez godine). Prazno = ne prikazuje se u widgetu
  // "Rođendani" (Task #24).
  birthdayDay: z.string().optional().or(z.literal("")),
  birthdayMonth: z.string().optional().or(z.literal("")),
});

/** Portal profil (app/admin/portal/profil/[email]/page.tsx) — admin smije
 * urediti SAMO svoj vlastiti profil (provjera ispod), ne tuđi, čak i ako
 * zna nečiji email u URL-u. */
export async function updateAdminProfileAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = ProfileSchema.safeParse({
    displayName: formData.get("displayName") || "",
    jobTitle: formData.get("jobTitle") || "",
    bio: formData.get("bio") || "",
    birthdayDay: formData.get("birthdayDay") || "",
    birthdayMonth: formData.get("birthdayMonth") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }

  // Oba polja moraju biti postavljena da rođendan uopće ima smisla — ako je
  // samo jedno odabrano (npr. korisnik očistio dan, a ostavio mjesec),
  // tretiraj kao "nema rođendana" umjesto da spremimo polovičan datum.
  const day = Number(parsed.data.birthdayDay);
  const month = Number(parsed.data.birthdayMonth);
  const hasBoth = parsed.data.birthdayDay && parsed.data.birthdayMonth && Number.isInteger(day) && Number.isInteger(month);
  const birthday = hasBoth ? `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;

  await updateAdminProfile(admin.adminId, {
    displayName: parsed.data.displayName || null,
    jobTitle: parsed.data.jobTitle || null,
    bio: parsed.data.bio || null,
    birthday,
  });
  revalidatePath(`/admin/portal/profil/${encodeURIComponent(admin.email)}`);
  return { success: true };
}

const StatusSchema = z.object({
  statusText: z.string().max(60).optional().or(z.literal("")),
  statusEmoji: z.string().max(4).optional().or(z.literal("")),
});

/** Slack-stil "što trenutačno radim" status iznad lika u Uredu (v8, Portal
 * Faza 4, components/admin/OfficeStatusForm.tsx) — admin uređuje SAMO svoj
 * vlastiti status (isti princip kao updateAdminProfileAction). Prazna oba
 * polja = briše status (vraća se na "bez statusa", ne prikazuje se oblačić).
 * Osim revalidacije layouta (za sljedeći SSR render), ostali klijenti u
 * uredu podignu promjenu preko postojećeg 20s pollinga na /api/admin/presence
 * — namjerno bez dodatne "push" infrastrukture za tako sitnu promjenu. */
export async function updateAdminStatusAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = StatusSchema.safeParse({
    statusText: formData.get("statusText") || "",
    statusEmoji: formData.get("statusEmoji") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unos." };
  }

  await updateAdminStatus(admin.adminId, {
    statusText: parsed.data.statusText?.trim() || null,
    statusEmoji: parsed.data.statusEmoji?.trim() || null,
  });
  revalidatePath("/admin/portal", "layout");
  return { success: true };
}
