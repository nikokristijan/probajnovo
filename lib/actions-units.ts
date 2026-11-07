"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { getAdminById, getPropertyById, hasAdminAccess } from "@/lib/db/queries";
import {
  blockUnitDateRange,
  getPropertyExtras,
  normalizeDestination, normalizeTexts,
  normalizeUnits,
  savePropertyExtras,
  toggleUnitBlockedDate,
} from "@/lib/db/units";

/**
 * Akcije za apartmane (jedinice) unutar jedne vikendice — vidi lib/db/units.ts.
 * Isti sigurnosni obrazac kao lib/actions.ts: kalendar smiju i vlasnici (samo
 * za SVOJE vikendice), a uređivanje apartmana/"Doživite" sekcije samo puni admin.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireAdminRow() {
  const session = await getCurrentAdmin();
  if (!session) redirect("/admin/login");
  const row = await getAdminById(session.adminId);
  if (!row) redirect("/admin/login");
  return row;
}

async function requirePropertyAccess(propertyId: number) {
  const admin = await requireAdminRow();
  if (admin.role === "owner" && !(await hasAdminAccess(admin.id, { propertyId }))) {
    redirect("/admin/inquiries");
  }
  return admin;
}

async function assertUnitExists(propertyId: number, unitSlug: string) {
  const extras = await getPropertyExtras(propertyId);
  if (!extras.units.some((u) => u.slug === unitSlug)) redirect("/admin/kalendar");
  return extras;
}

export async function toggleUnitBlockedDateAction(
  propertyId: number,
  unitSlug: string,
  date: string,
  currentlyBlocked: boolean
) {
  await requirePropertyAccess(propertyId);
  if (!DATE_RE.test(date)) redirect("/admin/kalendar");
  await assertUnitExists(propertyId, unitSlug);
  await toggleUnitBlockedDate(propertyId, unitSlug, date, currentlyBlocked);
  revalidatePath("/admin/kalendar");
  revalidatePath("/admin");
}

/** "Blokiraj raspon" za apartmane — polje "unit" je slug jednog apartmana ili "__all__" (svi). */
export async function blockUnitDateRangeAction(propertyId: number, redirectTo: string, formData: FormData) {
  await requirePropertyAccess(propertyId);
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const unit = String(formData.get("unit") ?? "");
  const safeRedirect = redirectTo.startsWith("/admin/kalendar") ? redirectTo : "/admin/kalendar";
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) redirect(safeRedirect);
  const spanDays = Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000
  );
  if (spanDays > 730) redirect(safeRedirect);

  const extras = await getPropertyExtras(propertyId);
  const targets = unit === "__all__" ? extras.units : extras.units.filter((u) => u.slug === unit);
  for (const u of targets) {
    await blockUnitDateRange(propertyId, u.slug, start, end);
  }
  revalidatePath("/admin/kalendar");
  redirect(safeRedirect);
}

export type SaveUnitsState = { ok: boolean; message: string } | null;

/** Sprema apartmane + "Doživite <lokacija>" sekciju (admin → Uredi vikendicu). Samo puni admin. */
export async function saveUnitsAction(
  propertyId: number,
  _prev: SaveUnitsState,
  formData: FormData
): Promise<SaveUnitsState> {
  const admin = await requireAdminRow();
  if (admin.role === "owner") redirect("/admin/inquiries");
  const property = await getPropertyById(propertyId);
  if (!property) return { ok: false, message: "Vikendica ne postoji." };

  let parsed: { units?: unknown; destination?: unknown; texts?: unknown };
  try {
    parsed = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, message: "Podaci nisu ispravni (JSON)." };
  }
  const units = normalizeUnits(parsed.units);
  const destination = normalizeDestination(parsed.destination);
  const texts = parsed.texts !== undefined ? normalizeTexts(parsed.texts) : undefined;
  await savePropertyExtras(propertyId, units, destination, texts);

  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath(`/${property.slug}`);
  revalidatePath(`/en/${property.slug}`);
  return {
    ok: true,
    message: `Spremljeno: ${units.length} ${units.length === 1 ? "apartman" : "apartmana"}${destination ? " + sekcija o destinaciji" : ""}.`,
  };
}
