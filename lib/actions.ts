"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getCurrentAdmin,
} from "@/lib/auth";
import {
  findAdminByEmail,
  updateAgency,
  createProperty,
  updateProperty,
  deleteProperty,
  createStudy,
  updateStudy,
  deleteStudy,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminById,
  listAdmins,
  createAdmin,
  deleteAdmin,
  countAdmins,
} from "@/lib/db/queries";

export type ActionState = { error?: string; success?: boolean } | undefined;

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "logout",
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
  "_next",
]);

/* ---------------------------------------------------------------- */
/* Prijava / odjava                                                  */
/* ---------------------------------------------------------------- */

const LoginSchema = z.object({
  email: z.string().email({ message: "Unesi ispravan email." }),
  password: z.string().min(1, { message: "Unesi lozinku." }),
});

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

  const token = await createSessionToken({ adminId: admin.id, email: admin.email });
  await setSessionCookie(token);
  redirect("/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/admin/login");
}

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  return admin;
}

/** Kao requireAdmin, ali dodatno provjeri je li ovaj admin glavni (super admin). */
async function requireSuperAdmin() {
  const admin = await requireAdmin();
  const row = await getAdminById(admin.adminId);
  if (!row || !row.isSuperAdmin) {
    redirect("/admin");
  }
  return { ...admin, row };
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
    testimonials: formData.get("testimonials") ?? "[]",
    faq: formData.get("faq") ?? "[]",
    imageCategories: formData.get("imageCategories") ?? "{}",
    videoUrl: formData.get("videoUrl") ?? "",
    seasonalPricing: formData.get("seasonalPricing") ?? "[]",
    availabilityUrl: formData.get("availabilityUrl") ?? "",
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

  try {
    await createProperty({
      ...parsed.data,
      amenities: parseAmenities(parsed.data.amenities),
      images: parseImages(parsed.data.images),
      bannerImage: parsed.data.bannerImage?.trim() || null,
      contactEmail: parsed.data.contactEmail?.trim() || null,
      checkInTime: parsed.data.checkInTime?.trim() || null,
      checkOutTime: parsed.data.checkOutTime?.trim() || null,
      houseRules: parseAmenities(parsed.data.houseRules ?? ""),
      hostName: parsed.data.hostName?.trim() || null,
      hostNote: parsed.data.hostNote?.trim() || null,
      mapUrl: parsed.data.mapUrl?.trim() || null,
      testimonials: parseTestimonials(parsed.data.testimonials),
      faq: parseFaq(parsed.data.faq),
      imageCategories: parseImageCategories(parsed.data.imageCategories),
      videoUrl: parsed.data.videoUrl?.trim() || null,
      seasonalPricing: parseSeasonalPricing(parsed.data.seasonalPricing),
      availabilityUrl: parsed.data.availabilityUrl?.trim() || null,
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
    testimonials: formData.get("testimonials") ?? "[]",
    faq: formData.get("faq") ?? "[]",
    imageCategories: formData.get("imageCategories") ?? "{}",
    videoUrl: formData.get("videoUrl") ?? "",
    seasonalPricing: formData.get("seasonalPricing") ?? "[]",
    availabilityUrl: formData.get("availabilityUrl") ?? "",
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

  try {
    await updateProperty(id, {
      ...parsed.data,
      amenities: parseAmenities(parsed.data.amenities),
      images: parseImages(parsed.data.images),
      bannerImage: parsed.data.bannerImage?.trim() || null,
      contactEmail: parsed.data.contactEmail?.trim() || null,
      checkInTime: parsed.data.checkInTime?.trim() || null,
      checkOutTime: parsed.data.checkOutTime?.trim() || null,
      houseRules: parseAmenities(parsed.data.houseRules ?? ""),
      hostName: parsed.data.hostName?.trim() || null,
      hostNote: parsed.data.hostNote?.trim() || null,
      mapUrl: parsed.data.mapUrl?.trim() || null,
      testimonials: parseTestimonials(parsed.data.testimonials),
      faq: parseFaq(parsed.data.faq),
      imageCategories: parseImageCategories(parsed.data.imageCategories),
      videoUrl: parsed.data.videoUrl?.trim() || null,
      seasonalPricing: parseSeasonalPricing(parsed.data.seasonalPricing),
      availabilityUrl: parsed.data.availabilityUrl?.trim() || null,
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
  return { success: true };
}

export async function deletePropertyAction(id: number) {
  await requireAdmin();
  await deleteProperty(id);
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
/* Admini (samo glavni admin smije upravljati drugim adminima)       */
/* ---------------------------------------------------------------- */

const AdminSchema = z.object({
  email: z.string().email({ message: "Unesi ispravan email." }),
  password: z.string().min(8, { message: "Lozinka mora imati barem 8 znakova." }),
});

export async function createAdminAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = AdminSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Provjeri unesene podatke." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await findAdminByEmail(email);
  if (existing) {
    return { error: "Već postoji admin s tim emailom." };
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await createAdmin({ email, passwordHash, isSuperAdmin: false });
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
