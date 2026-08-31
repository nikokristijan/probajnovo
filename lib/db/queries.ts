import { eq, desc, asc, and, gt, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  agency,
  properties,
  companies,
  studies,
  products,
  adminUsers,
  adminAccess,
  propertyBlockedDates,
  inquiries,
  propertyTranslationsEn,
  reservations,
  expenses,
  type NewProperty,
  type NewCompany,
  type NewStudy,
  type NewProduct,
  type NewInquiry,
  type NewPropertyTranslationEn,
} from "./schema";

const AGENCY_ROW_ID = 1;

export async function getAgency() {
const rows = await db.select().from(agency).where(eq(agency.id, AGENCY_ROW_ID)).limit(1);
return rows[0] ?? null;
}

export async function updateAgency(data: {
heroTitle: string;
officeText: string;
contactEmail: string;
instagramHandle: string;
city: string;
}) {
const [row] = await db
.update(agency)
.set({ ...data, updatedAt: new Date() })
.where(eq(agency.id, AGENCY_ROW_ID))
.returning();
return row;
}

export async function listProperties({ onlyPublished = false } = {}) {
const rows = await db.select().from(properties).orderBy(desc(properties.createdAt));
return onlyPublished ? rows.filter((p) => p.published) : rows;
}

export async function getPropertyBySlug(slug: string) {
const rows = await db.select().from(properties).where(eq(properties.slug, slug)).limit(1);
return rows[0] ?? null;
}

export async function getPropertyById(id: number) {
const rows = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
return rows[0] ?? null;
}

export async function createProperty(data: NewProperty) {
const [row] = await db.insert(properties).values(data).returning();
return row;
}

export async function updateProperty(id: number, data: Partial<NewProperty>) {
const [row] = await db
.update(properties)
.set({ ...data, updatedAt: new Date() })
.where(eq(properties.id, id))
.returning();
return row;
}

export async function deleteProperty(id: number) {
await db.delete(properties).where(eq(properties.id, id));
}

/** Isti razlog kao isMissingCompaniesTable ispod — tablica s prijevodima može zaostajati iza migracije. */
function isMissingTranslationsTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ("code" in err && (err as { code?: string }).code === "42P01") return true;
  const cause = (err as { cause?: unknown }).cause;
  return Boolean(cause && typeof cause === "object" && "code" in cause && (cause as { code?: string }).code === "42P01");
}

export async function getPropertyTranslationEn(propertyId: number) {
  try {
    const rows = await db
      .select()
      .from(propertyTranslationsEn)
      .where(eq(propertyTranslationsEn.propertyId, propertyId))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingTranslationsTable(err)) return null;
    throw err;
  }
}

/** Upsert po propertyId (jedan red po vikendici) — vidi lib/translate.ts za kad se ovo poziva. */
export async function savePropertyTranslationEn(
  propertyId: number,
  data: Omit<NewPropertyTranslationEn, "propertyId" | "id">
) {
  try {
    await db
      .insert(propertyTranslationsEn)
      .values({ propertyId, ...data })
      .onConflictDoUpdate({
        target: propertyTranslationsEn.propertyId,
        set: { ...data, updatedAt: new Date() },
      });
  } catch (err) {
    if (isMissingTranslationsTable(err)) return; // tiho odustani — vidi komentar gore
    throw err;
  }
}

/**
 * Postgres greška 42P01 = "relation ... does not exist" — baca je SVAKI upit
 * na `companies` dok admin ne pokrene SQL migraciju koja tu tablicu stvara
 * (migracije se namjerno NE pokreću automatski iz aplikacije). Dok ta tablica
 * ne postoji, čitanja iz nje tretiramo kao "nema firmi" umjesto da bacimo
 * grešku — inače bi /admin i SVAKA javna /[slug] stranica (i za nepostojeći
 * slug, koji inače treba samo prikazati 404) pukli s 500 greškom čim je ovaj
 * kod live, a prije nego stigne migracija. Nakon migracije ovaj catch se
 * više nikad ne aktivira (tablica postoji), pa ga nije potrebno uklanjati.
 */
function isMissingCompaniesTable(err: unknown): boolean {
  // Drizzle baca vlastitu "Failed query" grešku čiji je `.code` prazan — pravi
  // Postgres kod (42P01) živi na `.cause` (postgres.js greška), ne na samoj
  // bačenoj grešci. Provjeravamo oboje da uhvatimo pravi uzrok.
  if (!err || typeof err !== "object") return false;
  if ("code" in err && (err as { code?: string }).code === "42P01") return true;
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause && (cause as { code?: string }).code === "42P01") {
    return true;
  }
  return false;
}

/**
 * Slug provjera preko OBJE tablice (properties + companies) — dijele isti
 * plošni /[slug] URL prostor, pa dvije različite stranice ne smiju dobiti
 * isti slug. `excludeId`/`excludeTable` isključuju red koji se trenutno
 * uređuje (da ne prijavi sukob sam sa sobom).
 */
export async function isSlugTaken(
  slug: string,
  exclude?: { table: "properties" | "companies"; id: number }
) {
  const propRowsPromise = db.select({ id: properties.id }).from(properties).where(eq(properties.slug, slug));
  const compRowsPromise = db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .catch((err) => {
      if (isMissingCompaniesTable(err)) return [];
      throw err;
    });
  const [propRows, compRows] = await Promise.all([propRowsPromise, compRowsPromise]);
  const propTaken = propRows.some(
    (r) => !(exclude?.table === "properties" && exclude.id === r.id)
  );
  const compTaken = compRows.some(
    (r) => !(exclude?.table === "companies" && exclude.id === r.id)
  );
  return propTaken || compTaken;
}

export async function listCompanies({ onlyPublished = false } = {}) {
  try {
    const rows = await db.select().from(companies).orderBy(desc(companies.createdAt));
    return onlyPublished ? rows.filter((c) => c.published) : rows;
  } catch (err) {
    if (isMissingCompaniesTable(err)) return [];
    throw err;
  }
}

export async function getCompanyBySlug(slug: string) {
  try {
    const rows = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingCompaniesTable(err)) return null;
    throw err;
  }
}

export async function getCompanyById(id: number) {
  try {
    const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingCompaniesTable(err)) return null;
    throw err;
  }
}

export async function createCompany(data: NewCompany) {
const [row] = await db.insert(companies).values(data).returning();
return row;
}

export async function updateCompany(id: number, data: Partial<NewCompany>) {
const [row] = await db
.update(companies)
.set({ ...data, updatedAt: new Date() })
.where(eq(companies.id, id))
.returning();
return row;
}

export async function deleteCompany(id: number) {
await db.delete(companies).where(eq(companies.id, id));
}

export async function listStudies({ onlyPublished = false } = {}) {
const rows = await db
.select()
.from(studies)
.orderBy(desc(studies.year), studies.position, desc(studies.createdAt));
return onlyPublished ? rows.filter((s) => s.published) : rows;
}

export async function getStudyById(id: number) {
const rows = await db.select().from(studies).where(eq(studies.id, id)).limit(1);
return rows[0] ?? null;
}

export async function createStudy(data: NewStudy) {
const [row] = await db.insert(studies).values(data).returning();
return row;
}

export async function updateStudy(id: number, data: Partial<NewStudy>) {
const [row] = await db
.update(studies)
.set({ ...data, updatedAt: new Date() })
.where(eq(studies.id, id))
.returning();
return row;
}

export async function deleteStudy(id: number) {
await db.delete(studies).where(eq(studies.id, id));
}

export async function listProducts({ onlyPublished = false } = {}) {
const rows = await db.select().from(products).orderBy(asc(products.position), desc(products.createdAt));
return onlyPublished ? rows.filter((p) => p.published) : rows;
}

export async function getProductById(id: number) {
const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
return rows[0] ?? null;
}

export async function createProduct(data: NewProduct) {
const [row] = await db.insert(products).values(data).returning();
return row;
}

export async function updateProduct(id: number, data: Partial<NewProduct>) {
const [row] = await db
.update(products)
.set({ ...data, updatedAt: new Date() })
.where(eq(products.id, id))
.returning();
return row;
}

export async function deleteProduct(id: number) {
await db.delete(products).where(eq(products.id, id));
}

/**
 * Ista logika kao isMissingCompaniesTable gore (Postgres 42P01 = "relation
 * does not exist"), zasebna provjera za `inquiries` jer ta tablica može
 * zaostajati iza migracije neovisno o companies.
 */
function isMissingInquiriesTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ("code" in err && (err as { code?: string }).code === "42P01") return true;
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause && (cause as { code?: string }).code === "42P01") {
    return true;
  }
  return false;
}

export async function listInquiries() {
  try {
    return await db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
  } catch (err) {
    if (isMissingInquiriesTable(err)) return [];
    throw err;
  }
}

export async function countUnreadInquiries() {
  try {
    const rows = await db.select({ id: inquiries.id }).from(inquiries).where(eq(inquiries.read, false));
    return rows.length;
  } catch (err) {
    if (isMissingInquiriesTable(err)) return 0;
    throw err;
  }
}

export async function getInquiryById(id: number) {
  try {
    const rows = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingInquiriesTable(err)) return null;
    throw err;
  }
}

export async function createInquiry(data: NewInquiry) {
  const [row] = await db.insert(inquiries).values(data).returning();
  return row;
}

/** Broj upita s te IP adrese poslanih nakon `since` — jednostavan rate-limit protiv spama (vidi createInquiryAction). */
export async function countRecentInquiriesByIp(ip: string, since: Date): Promise<number> {
  try {
    const rows = await db
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(and(eq(inquiries.ip, ip), gt(inquiries.createdAt, since)));
    return rows.length;
  } catch (err) {
    if (isMissingInquiriesTable(err)) return 0;
    throw err;
  }
}

export async function markInquiryRead(id: number) {
  await db.update(inquiries).set({ read: true }).where(eq(inquiries.id, id));
}

export async function markInquiryReplied(id: number) {
  await db.update(inquiries).set({ replied: true }).where(eq(inquiries.id, id));
}

export async function deleteInquiry(id: number) {
  await db.delete(inquiries).where(eq(inquiries.id, id));
}

export async function findAdminByEmail(email: string) {
const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
return rows[0] ?? null;
}

export async function getAdminById(id: number) {
const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
return rows[0] ?? null;
}

export async function listAdmins() {
return db.select().from(adminUsers).orderBy(adminUsers.createdAt);
}

export async function createAdmin(data: {
  email: string;
  passwordHash: string;
  isSuperAdmin?: boolean;
  role?: "admin" | "owner";
}) {
const [row] = await db
.insert(adminUsers)
.values({
  email: data.email,
  passwordHash: data.passwordHash,
  isSuperAdmin: data.isSuperAdmin ?? false,
  role: data.role ?? "admin",
})
.returning();
return row;
}

export async function updateAdminPassword(id: number, passwordHash: string) {
await db.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, id));
}

export async function deleteAdmin(id: number) {
  // admin_access redci nemaju FK/cascade (jednostavnosti radi), pa ih ručno pospremimo
  // prije brisanja admina da ne ostanu siročad.
  await db.delete(adminAccess).where(eq(adminAccess.adminId, id));
  await db.delete(adminUsers).where(eq(adminUsers.id, id));
}

export async function countAdmins() {
const rows = await db.select().from(adminUsers);
return rows.length;
}

/* ---------------------------------------------------------------- */
/* Pristup vlasnika (admin_access) — koje vikendice/firme smije       */
/* gledati koji "owner" admin_users redak (vidi lib/auth.ts,          */
/* lib/actions.ts assertPropertyAccess/assertCompanyAccess).          */
/* ---------------------------------------------------------------- */

export async function getAdminAccessGrants(adminId: number) {
  return db.select().from(adminAccess).where(eq(adminAccess.adminId, adminId));
}

export async function hasAdminAccess(
  adminId: number,
  target: { propertyId?: number; companyId?: number }
): Promise<boolean> {
  const grants = await getAdminAccessGrants(adminId);
  if (target.propertyId != null) {
    return grants.some((g) => g.propertyId === target.propertyId);
  }
  if (target.companyId != null) {
    return grants.some((g) => g.companyId === target.companyId);
  }
  return false;
}

/** Zamijeni SVE dodjele pristupa za ovog admina novim popisom (koristi se pri
    kreiranju vlasničkog računa — vidi createAdminAction). */
export async function setAdminAccess(
  adminId: number,
  grants: { propertyIds: number[]; companyIds: number[] }
) {
  await db.delete(adminAccess).where(eq(adminAccess.adminId, adminId));
  const rows = [
    ...grants.propertyIds.map((propertyId) => ({ adminId, propertyId, companyId: null })),
    ...grants.companyIds.map((companyId) => ({ adminId, companyId, propertyId: null })),
  ];
  if (rows.length > 0) {
    await db.insert(adminAccess).values(rows);
  }
}

/** Vikendice na koje ovaj admin (bilo koje uloge) ima pristup — za "admin" ulogu
    su to SVE vikendice, za "owner" samo dodijeljene (vidi getAdminAccessGrants). */
export async function listPropertiesForAdmin(admin: { id: number; role: string }) {
  if (admin.role !== "owner") return listProperties();
  const grants = await getAdminAccessGrants(admin.id);
  const ids = grants.map((g) => g.propertyId).filter((id): id is number => id != null);
  if (ids.length === 0) return [];
  return db.select().from(properties).where(inArray(properties.id, ids));
}

/** Firme na koje ovaj admin ima pristup — isti duh kao listPropertiesForAdmin. */
export async function listCompaniesForAdmin(admin: { id: number; role: string }) {
  if (admin.role !== "owner") return listCompanies();
  const grants = await getAdminAccessGrants(admin.id);
  const ids = grants.map((g) => g.companyId).filter((id): id is number => id != null);
  if (ids.length === 0) return [];
  return db.select().from(companies).where(inArray(companies.id, ids));
}

/** Upiti na koje ovaj admin ima pristup — vlasnik SAMO svojih dodijeljenih
    vikendica/firmi (nikad agencijske upite ni tuđe vikendice), puni admin sve.
    Zajednička funkcija za app/admin/inquiries i CSV izvoz
    (app/api/admin/inquiries/export) da ta dva mjesta ne mogu razjediniti (drift). */
export async function listInquiriesForAdmin(admin: { id: number; role: string }) {
  const all = await listInquiries();
  if (admin.role !== "owner") return all;

  const [ownedProperties, ownedCompanies] = await Promise.all([
    listPropertiesForAdmin(admin),
    listCompaniesForAdmin(admin),
  ]);
  const propertyIds = new Set(ownedProperties.map((p) => p.id));
  const companyIds = new Set(ownedCompanies.map((c) => c.id));
  return all.filter(
    (i) =>
      (i.source === "property" && i.sourceId != null && propertyIds.has(i.sourceId)) ||
      (i.source === "company" && i.sourceId != null && companyIds.has(i.sourceId))
  );
}

/* ---------------------------------------------------------------- */
/* Blokirani datumi (kalendar dostupnosti) — vidi app/admin/kalendar  */
/* i lib/ical.ts.                                                     */
/* ---------------------------------------------------------------- */

export async function listBlockedDates(propertyId: number) {
  return db
    .select()
    .from(propertyBlockedDates)
    .where(eq(propertyBlockedDates.propertyId, propertyId));
}

export async function addManualBlockedDate(propertyId: number, date: string) {
  const existing = await db
    .select({ id: propertyBlockedDates.id })
    .from(propertyBlockedDates)
    .where(and(eq(propertyBlockedDates.propertyId, propertyId), eq(propertyBlockedDates.date, date)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(propertyBlockedDates).values({ propertyId, date, source: "manual" });
}

export async function removeManualBlockedDate(propertyId: number, date: string) {
  await db
    .delete(propertyBlockedDates)
    .where(
      and(
        eq(propertyBlockedDates.propertyId, propertyId),
        eq(propertyBlockedDates.date, date),
        eq(propertyBlockedDates.source, "manual")
      )
    );
}

/** Blokira SVE dane u ["YYYY-MM-DD" rasponu] odjednom (uključivo oba kraja) —
    za "Blokiraj raspon" u /admin/kalendar, umjesto klikanja dan po dan.
    Ponovno koristi addManualBlockedDate (isti "preskoči ako već postoji"
    dedup), pa ne diramo dane koji su već ical-blokirani niti dupliciramo
    postojeće ručne. Datumi se generiraju kao obični stringovi (ne Date
    aritmetika) da izbjegnemo probleme s vremenskim zonama oko ponoći. */
export async function blockManualDateRange(propertyId: number, startDate: string, endDate: string) {
  const dates = datesInRange(startDate, endDate);
  for (const date of dates) {
    await addManualBlockedDate(propertyId, date);
  }
  return dates.length;
}

function datesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

/** Zamijeni SVE "ical"-izvorne blokirane datume za ovu vikendicu novim popisom
    (poziva se pri svakom cron sync-u — vidi app/api/cron/sync-ical). Ručno
    uneseni ("manual") datumi se ne diraju. */
export async function replaceIcalBlockedDates(propertyId: number, dates: string[]) {
  await db
    .delete(propertyBlockedDates)
    .where(and(eq(propertyBlockedDates.propertyId, propertyId), eq(propertyBlockedDates.source, "ical")));
  if (dates.length > 0) {
    await db
      .insert(propertyBlockedDates)
      .values(dates.map((date) => ({ propertyId, date, source: "ical" as const })));
  }
}

/** Sve vikendice koje imaju postavljen icalUrl — koristi cron endpoint da zna koje sync-ati. */
export async function getPropertiesWithIcalUrl() {
  const rows = await db
    .select({ id: properties.id, icalUrl: properties.icalUrl })
    .from(properties);
  return rows.filter((r): r is { id: number; icalUrl: string } => !!r.icalUrl);
}

/* ---------------------------------------------------------------- */
/* Rezervacije (puna knjiga rezervacija) — zamjena za vlasnikovu       */
/* bilježnicu, vidi app/admin/rezervacije. Kreiranje rezervacije       */
/* automatski blokira noćenja u kalendaru (property_blocked_dates,     */
/* source "reservation"), brisanje ih precizno uklanja preko           */
/* reservationId — vidi lib/db/schema.ts komentare.                    */
/* ---------------------------------------------------------------- */

export async function listReservationsForProperty(propertyId: number) {
  return db
    .select()
    .from(reservations)
    .where(eq(reservations.propertyId, propertyId))
    .orderBy(asc(reservations.checkIn));
}

export async function createReservation(data: {
  propertyId: number;
  guestName: string;
  phone: string | null;
  email: string | null;
  checkIn: string;
  checkOut: string;
  priceEur: number;
  paid: boolean;
  note: string | null;
}) {
  // Ako je odmah označeno plaćenim pri unosu (checkbox "Već plaćeno"), postavi
  // paidAt SAD — isti trenutak koji setReservationPaid koristi za naknadno
  // označavanje, vidi getMonthlyEarnings (gotovinska baza, ne checkIn).
  const [reservation] = await db
    .insert(reservations)
    .values({ ...data, paidAt: data.paid ? new Date() : null })
    .returning();

  // Blokiraj noćenja: checkIn do dan PRIJE checkOut — dan odjave ostaje
  // slobodan za sljedećeg gosta (standardna booking konvencija, isto kao
  // Booking.com/Airbnb iCal koje već sync-amo). Datumi koji su već blokirani
  // (ručno, ical ili druga rezervacija) se preskaču, isti dedup obrazac kao
  // addManualBlockedDate gore — te preskočene datume vraćamo pozivatelju kao
  // `overlappingDates` da createReservationAction može upozoriti vlasnika na
  // moguću dvostruku rezervaciju (vidi lib/actions.ts).
  const nights = datesInRange(data.checkIn, data.checkOut).slice(0, -1);
  const overlappingDates: string[] = [];
  for (const date of nights) {
    const existing = await db
      .select({ id: propertyBlockedDates.id })
      .from(propertyBlockedDates)
      .where(and(eq(propertyBlockedDates.propertyId, data.propertyId), eq(propertyBlockedDates.date, date)))
      .limit(1);
    if (existing.length > 0) {
      overlappingDates.push(date);
      continue;
    }
    await db.insert(propertyBlockedDates).values({
      propertyId: data.propertyId,
      date,
      source: "reservation",
      reservationId: reservation.id,
    });
  }

  return { reservation, overlappingDates };
}

/** Briše rezervaciju i SAMO blokirane dane koji joj pripadaju (preko
    reservationId) — ručno/ical blokirani dani za iste datume ostaju netaknuti. */
export async function deleteReservation(id: number) {
  await db.delete(propertyBlockedDates).where(eq(propertyBlockedDates.reservationId, id));
  await db.delete(reservations).where(eq(reservations.id, id));
}

/** Postavlja paidAt na SAD kad se označi plaćenim, čisti ga kad se odznači —
    vidi getMonthlyEarnings (obračun po mjesecu u kojem je OZNAČENO plaćeno,
    ne po checkIn/checkOut). */
export async function setReservationPaid(id: number, paid: boolean) {
  await db
    .update(reservations)
    .set({ paid, paidAt: paid ? new Date() : null })
    .where(eq(reservations.id, id));
}

/* ---------------------------------------------------------------- */
/* Troškovi (opcionalno, za neto zaradu) — vidi app/admin/rezervacije. */
/* ---------------------------------------------------------------- */

export async function listExpensesForProperty(propertyId: number) {
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.propertyId, propertyId))
    .orderBy(desc(expenses.date));
}

export async function createExpense(data: {
  propertyId: number;
  description: string;
  amountEur: number;
  date: string;
}) {
  const [expense] = await db.insert(expenses).values(data).returning();
  return expense;
}

export async function deleteExpense(id: number) {
  await db.delete(expenses).where(eq(expenses.id, id));
}

function monthPrefixOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Zarada za mjesec (monthPrefix format "YYYY-MM") preko svih zadanih
    vikendica — bruto je zbroj cijena SAMO plaćenih rezervacija OZNAČENIH
    plaćenim u tom mjesecu (paidAt), po vlasnikovom izričitom pravilu ("kad
    oznaci da je placeno uracuna se u zaradu"). Namjerno gotovinska baza, ne
    checkIn/checkOut — rezervacija za sljedeći mjesec plaćena unaprijed danas
    ulazi u OVOMJESEČNU zaradu, jer je novac stigao sad. Neto dodatno
    oduzima troškove čiji `date` pada u taj mjesec (opcionalno polje, vidi
    expenses gore — tu OSTAJE datum troška, ne datum unosa, da vlasnik može
    unaprijed upisati budući trošak bez da odmah utječe na tekući mjesec).
    Koristi se na vlasnikovom dashboardu (app/admin/page.tsx) i
    /admin/rezervacije. */
export async function getMonthlyEarnings(propertyIds: number[], monthPrefix: string) {
  if (propertyIds.length === 0) return { grossEur: 0, expensesEur: 0, netEur: 0 };

  const [allReservations, allExpenses] = await Promise.all([
    db.select().from(reservations).where(inArray(reservations.propertyId, propertyIds)),
    db.select().from(expenses).where(inArray(expenses.propertyId, propertyIds)),
  ]);

  const grossEur = allReservations
    .filter((r) => r.paid && r.paidAt && monthPrefixOf(new Date(r.paidAt)) === monthPrefix)
    .reduce((sum, r) => sum + r.priceEur, 0);
  const expensesEur = allExpenses
    .filter((e) => e.date.startsWith(monthPrefix))
    .reduce((sum, e) => sum + e.amountEur, 0);

  return { grossEur, expensesEur, netEur: grossEur - expensesEur };
}
