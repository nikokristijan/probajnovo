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
  published: z.coerce.boolean(),
});

function parseAmenities(raw: string): string[] {
  return raw
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
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
    published: formData.get("published") === "on",
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
  });
} catch {
  return { error: "Ta adresa (slug) je već zauzeta — odaberi drugu." };
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
    published: formData.get("published") === "on",
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
  });
} catch {
  return { error: "Ta adresa (slug) je već zauzeta — odaberi drugu." };
}

revalidatePath("/");
  revalidatePath(`/${parsed.data.slug}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function deletePropertyAction(id: number) {
  await requireAdmin();
  await deleteProperty(id);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}
