import { eq, desc, asc, and, gt, inArray, isNull, sql } from "drizzle-orm";
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
  sales,
  activityLog,
  pageViews,
  pushSubscriptions,
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

/* ---------------------------------------------------------------- */
/* Dvofaktorska prijava (2FA/TOTP) — samo-postavljanje u /admin/settings, */
/* vidi lib/actions.ts startTwoFactorSetupAction/confirmTwoFactorSetupAction/ */
/* disableTwoFactorAction i lib/auth.ts za provjeru pri prijavi.            */
/* ---------------------------------------------------------------- */

/** Sprema TOTP tajnu bez uključivanja 2FA — admin mora prvo unijeti jedan
    ispravan kod (confirmTwoFactorSetupAction) da se twoFactorEnabled postavi
    na true, inače bi krivo skeniran QR kod mogao zaključati admina iz
    vlastitog računa. */
export async function setTwoFactorSecret(id: number, secret: string) {
  await db.update(adminUsers).set({ twoFactorSecret: secret, twoFactorEnabled: false }).where(eq(adminUsers.id, id));
}

export async function enableTwoFactor(id: number) {
  await db.update(adminUsers).set({ twoFactorEnabled: true }).where(eq(adminUsers.id, id));
}

export async function disableTwoFactor(id: number) {
  await db
    .update(adminUsers)
    .set({ twoFactorEnabled: false, twoFactorSecret: null })
    .where(eq(adminUsers.id, id));
}

/**
 * Puni backup SVIH vikendica odjednom (rezervacije + troškovi po vikendici)
 * — za automatski tjedni backup mailom, vidi app/api/cron/weekly-backup.
 * Isti podaci kao "Backup (JSON)" gumb po vikendici (app/api/admin/backup),
 * samo objedinjeni preko svih vikendica u jedan izvoz da vlasnik agencije ne
 * mora skupljati po jedan po jedan.
 */
export async function getFullBackupData() {
  const properties = await listProperties();
  const perProperty = await Promise.all(
    properties.map(async (property) => {
      const [reservations, expenses] = await Promise.all([
        listReservationsForProperty(property.id),
        listExpensesForProperty(property.id),
      ]);
      return { property: property.name, slug: property.slug, reservations, expenses };
    })
  );
  return { exportedAt: new Date().toISOString(), properties: perProperty };
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

/* ---------------------------------------------------------------- */
/* Web Push obavijesti (push_subscriptions) — vidi lib/push.ts        */
/* sendPushToAdmins i lib/db/schema.ts pushSubscriptions.             */
/* ---------------------------------------------------------------- */

/** Spremi/osvježi pretplatu za ovaj uređaj (upsert preko endpoint, jedinstven
    po pregledniku/uređaju — vidi shemu) — poziva se iz
    app/api/admin/push/subscribe kad admin uključi obavijesti. */
export async function savePushSubscription(data: {
  adminId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  await db
    .insert(pushSubscriptions)
    .values(data)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { adminId: data.adminId, p256dh: data.p256dh, auth: data.auth },
    });
}

/** Makni pretplatu za ovaj uređaj (admin isključio obavijesti, ili istekla
    pretplata koju je push servis odbio — vidi lib/push.ts). */
export async function deletePushSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Ima li ovaj admin BAREM JEDAN uređaj s uključenim obavijestima — za
    prikaz stanja prekidača u postavkama (TwoFactorSetupForm-stil komponenta,
    vidi PushNotificationToggle). */
export async function hasPushSubscription(adminId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.adminId, adminId))
    .limit(1);
  return rows.length > 0;
}

/** Jednokratni "popravi bazu" gumb u postavkama (vidi lib/actions.ts
    runPushMigrationAction) — kreira push_subscriptions tablicu ako slučajno
    ne postoji (npr. netko zaboravio pokrenuti SQL migraciju ručno). Koristi
    IF NOT EXISTS pa je sigurno pozvati i više puta / kad tablica već postoji. */
export async function ensurePushSubscriptionsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}

/** Sve pretplate (svi uređaji) za zadani popis admin ID-eva — jedan admin
    može imati više uređaja pa svaki dobiva svoju obavijest. */
export async function listPushSubscriptionsForAdmins(adminIds: number[]) {
  if (adminIds.length === 0) return [];
  return db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.adminId, adminIds));
}

/** BAŠ SVAKA pretplata u bazi, bez filtera po adminu — za broadcast obavijest
    (vidi lib/push.ts sendPushToAllDevices i sendBroadcastPushAction). */
export async function listAllPushSubscriptions() {
  return db.select().from(pushSubscriptions);
}

/** Koji admini (id) trebaju dobiti push obavijest za događaj vezan uz ovu
    vikendicu/firmu — puni "admin" (vidi sve, uvijek se obavještava) +
    "owner" koji ima BAŠ tu vikendicu/firmu dodijeljenu (setAdminAccess).
    Zajednička funkcija za sva tri okidača (nova rezervacija/upit, podsjetnik
    gost sutra stiže — vidi lib/push.ts sendPushToAdmins pozivatelje). */
export async function listAdminIdsForNotification(target: {
  propertyId?: number;
  companyId?: number;
}): Promise<number[]> {
  const all = await listAdmins();
  const fullAdminIds = all.filter((a) => a.role !== "owner").map((a) => a.id);
  const ownerIds = all.filter((a) => a.role === "owner").map((a) => a.id);
  if (ownerIds.length === 0) return fullAdminIds;

  const grants = await db
    .select()
    .from(adminAccess)
    .where(inArray(adminAccess.adminId, ownerIds));
  const matchingOwnerIds = grants
    .filter((g) =>
      target.propertyId != null
        ? g.propertyId === target.propertyId
        : target.companyId != null
        ? g.companyId === target.companyId
        : false
    )
    .map((g) => g.adminId);

  return [...new Set([...fullAdminIds, ...matchingOwnerIds])];
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
  guestCount: number | null;
  depositEur: number | null;
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

/** Postavlja kaparu (EUR) — informativno, ne dira `paid`/getMonthlyEarnings
    (vidi komentar uz reservations.depositEur u schema.ts). null briše kaparu. */
export async function setReservationDeposit(id: number, depositEur: number | null) {
  await db.update(reservations).set({ depositEur }).where(eq(reservations.id, id));
}

export async function markReservationConfirmationSent(id: number) {
  await db.update(reservations).set({ confirmationSentAt: new Date() }).where(eq(reservations.id, id));
}

/** Rezervacije čiji je checkIn TOČNO `dateStr` ("YYYY-MM-DD"), a podsjetnik
    još nije poslan — za app/api/cron/reservation-reminders. */
export async function listReservationsForReminderOn(dateStr: string) {
  return db
    .select()
    .from(reservations)
    .where(and(eq(reservations.checkIn, dateStr), isNull(reservations.reminderSentAt)));
}

export async function markReservationReminderSent(id: number) {
  await db.update(reservations).set({ reminderSentAt: new Date() }).where(eq(reservations.id, id));
}

/** Rezervacije čiji je checkOut TOČNO `dateStr`, a zamolba za recenziju još
    nije poslana — za app/api/cron/review-requests. */
export async function listReservationsForReviewRequestOn(dateStr: string) {
  return db
    .select()
    .from(reservations)
    .where(and(eq(reservations.checkOut, dateStr), isNull(reservations.reviewRequestSentAt)));
}

export async function markReservationReviewRequestSent(id: number) {
  await db.update(reservations).set({ reviewRequestSentAt: new Date() }).where(eq(reservations.id, id));
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
  category: string;
}) {
  const [expense] = await db.insert(expenses).values(data).returning();
  return expense;
}

export async function deleteExpense(id: number) {
  await db.delete(expenses).where(eq(expenses.id, id));
}

/** Zarada za mjesec (monthPrefix format "YYYY-MM") preko svih zadanih
    vikendica — bruto je zbroj cijena SAMO plaćenih rezervacija čiji je
    datum dolaska (checkIn) u tom mjesecu: zarada prati kad gost STVARNO
    BORAVI, ne kad je vlasnik stigao označiti plaćeno (npr. rezervacija za
    12.–14.9. plaćena unaprijed u kolovozu i dalje ulazi u zaradu RUJNA, ne
    kolovoza). "paid" je i dalje uvjet ("kad oznaci da je placeno uracuna se
    u zaradu") — neplaćene rezervacije se nikad ne broje, bez obzira na
    checkIn. Neto dodatno oduzima troškove čiji `date` pada u taj mjesec
    (opcionalno polje, vidi expenses gore). Koristi se na vlasnikovom
    dashboardu (app/admin/page.tsx) i /admin/rezervacije, koja ima ← →
    navigaciju po mjesecima da vlasnik vidi zaradu za bilo koji mjesec, ne
    samo tekući. */
export async function getMonthlyEarnings(propertyIds: number[], monthPrefix: string) {
  if (propertyIds.length === 0) return { grossEur: 0, expensesEur: 0, netEur: 0 };

  const [allReservations, allExpenses] = await Promise.all([
    db.select().from(reservations).where(inArray(reservations.propertyId, propertyIds)),
    db.select().from(expenses).where(inArray(expenses.propertyId, propertyIds)),
  ]);

  const grossEur = allReservations
    .filter((r) => r.paid && r.checkIn.startsWith(monthPrefix))
    .reduce((sum, r) => sum + r.priceEur, 0);
  const expensesEur = allExpenses
    .filter((e) => e.date.startsWith(monthPrefix))
    .reduce((sum, e) => sum + e.amountEur, 0);

  return { grossEur, expensesEur, netEur: grossEur - expensesEur };
}

/* ---------------------------------------------------------------- */
/* Zarada agencije (prodaja stranica/proizvoda/usluga) — vidi         */
/* app/admin/prodaja. Potpuno odvojeno od vikendica gore.             */
/* ---------------------------------------------------------------- */

export const SALE_CATEGORIES = ["stranica", "proizvod", "konzultacija", "ostalo"] as const;
export type SaleCategory = (typeof SALE_CATEGORIES)[number];

export async function listSales() {
  return db.select().from(sales).orderBy(desc(sales.date));
}

export async function createSale(data: {
  category: string;
  item: string;
  buyerName: string | null;
  priceEur: number;
  date: string;
  note: string | null;
}) {
  const [sale] = await db.insert(sales).values(data).returning();
  return sale;
}

export async function deleteSale(id: number) {
  await db.delete(sales).where(eq(sales.id, id));
}

/** Zarada agencije za mjesec (monthPrefix "YYYY-MM") — ukupno, broj prodaja
    i raščlamba po kategoriji, za /admin/prodaja (isti obrazac kao
    getMonthlyEarnings za vikendice, ali bez koncepta "plaćeno" — svaka
    unesena prodaja se odmah broji, nema gotovinske/računske razlike jer je
    ovo ručni knjigovodstveni unos nakon što je novac već primljen). */
export async function getSalesMonthlyEarnings(monthPrefix: string) {
  const all = await listSales();
  const inMonth = all.filter((s) => s.date.startsWith(monthPrefix));
  const totalEur = inMonth.reduce((sum, s) => sum + s.priceEur, 0);
  const byCategory: Record<string, number> = {};
  for (const s of inMonth) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + s.priceEur;
  }
  return { totalEur, count: inMonth.length, byCategory };
}

/** Zarada agencije po mjesecu za cijelu `year` (12 brojeva, siječanj→prosinac)
    — za godišnji graf na /admin/prodaja. */
export async function getSalesYearlyByMonth(year: number) {
  const all = await listSales();
  const totals = Array(12).fill(0) as number[];
  for (const s of all) {
    if (!s.date.startsWith(String(year))) continue;
    const monthIdx = Number(s.date.slice(5, 7)) - 1;
    if (monthIdx >= 0 && monthIdx < 12) totals[monthIdx] += s.priceEur;
  }
  return totals;
}

/* ---------------------------------------------------------------- */
/* Godišnja zarada, popunjenost i raščlamba troškova po kategoriji    */
/* za VIKENDICE (za razliku od gore, koje su za agenciju) — vidi      */
/* app/admin/rezervacije.                                             */
/* ---------------------------------------------------------------- */

/** Bruto zarada (samo plaćene rezervacije, po checkIn mjesecu — isti obrazac
    kao getMonthlyEarnings) po mjesecu za `year`, preko zadanih vikendica. */
export async function getYearlyEarningsByMonth(propertyIds: number[], year: number) {
  const totals = Array(12).fill(0) as number[];
  if (propertyIds.length === 0) return totals;
  const all = await db.select().from(reservations).where(inArray(reservations.propertyId, propertyIds));
  for (const r of all) {
    if (!r.paid || !r.checkIn.startsWith(String(year))) continue;
    const monthIdx = Number(r.checkIn.slice(5, 7)) - 1;
    if (monthIdx >= 0 && monthIdx < 12) totals[monthIdx] += r.priceEur;
  }
  return totals;
}

export type AccountingReportMonth = {
  month: number; // 1-12
  grossEur: number;
  expensesEur: number;
  netEur: number;
  expensesByCategory: Record<string, number>;
};

/**
 * Mjesečni financijski izvještaj JEDNE vikendice za JEDNU godinu — "Izvještaj
 * za knjigovođu" (vidi app/api/admin/reports/accounting). Bruto/troškovi/neto
 * po ISTOJ logici kao getMonthlyEarnings (bruto = samo plaćene rezervacije,
 * po checkIn mjesecu; troškovi po expenses.date), samo razloženo po svih 12
 * mjeseci odjednom (dva upita umjesto 12×2) i uz raščlambu troškova po
 * kategoriji po mjesecu.
 */
export async function getAccountingReport(propertyId: number, year: number) {
  const [allReservations, allExpenses] = await Promise.all([
    db.select().from(reservations).where(eq(reservations.propertyId, propertyId)),
    db.select().from(expenses).where(eq(expenses.propertyId, propertyId)),
  ]);

  const months: AccountingReportMonth[] = Array.from({ length: 12 }, (_, i) => {
    const monthPrefix = `${year}-${String(i + 1).padStart(2, "0")}`;
    const grossEur = allReservations
      .filter((r) => r.paid && r.checkIn.startsWith(monthPrefix))
      .reduce((sum, r) => sum + r.priceEur, 0);
    const monthExpenses = allExpenses.filter((e) => e.date.startsWith(monthPrefix));
    const expensesByCategory: Record<string, number> = {};
    for (const e of monthExpenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amountEur;
    }
    const expensesEur = monthExpenses.reduce((sum, e) => sum + e.amountEur, 0);
    return { month: i + 1, grossEur, expensesEur, netEur: grossEur - expensesEur, expensesByCategory };
  });

  const totals = months.reduce(
    (acc, m) => ({
      grossEur: acc.grossEur + m.grossEur,
      expensesEur: acc.expensesEur + m.expensesEur,
      netEur: acc.netEur + m.netEur,
    }),
    { grossEur: 0, expensesEur: 0, netEur: 0 }
  );
  const categoryTotals: Record<string, number> = {};
  for (const m of months) {
    for (const [cat, amt] of Object.entries(m.expensesByCategory)) {
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + amt;
    }
  }

  return { year, months, totals, categoryTotals };
}

/** Raščlamba troškova po kategoriji za mjesec (monthPrefix "YYYY-MM"), za
    jednu ili više vikendica. */
export async function getExpenseCategoryBreakdown(propertyIds: number[], monthPrefix: string) {
  if (propertyIds.length === 0) return {};
  const all = await db.select().from(expenses).where(inArray(expenses.propertyId, propertyIds));
  const byCategory: Record<string, number> = {};
  for (const e of all) {
    if (!e.date.startsWith(monthPrefix)) continue;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountEur;
  }
  return byCategory;
}

/** Popunjenost (% dana zauzeto preko bilo kojeg izvora — ručno/iCal/
    rezervacija) i prosječna noćna cijena (preko plaćenih rezervacija čiji
    checkIn pada u mjesec) za JEDNU vikendicu i mjesec — vidi
    app/admin/rezervacije. */
export async function getOccupancyStats(propertyId: number, monthPrefix: string) {
  const [year, month] = monthPrefix.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [blocked, allReservations] = await Promise.all([
    db.select().from(propertyBlockedDates).where(eq(propertyBlockedDates.propertyId, propertyId)),
    db.select().from(reservations).where(eq(reservations.propertyId, propertyId)),
  ]);
  const daysBooked = new Set(
    blocked.filter((b) => b.date.startsWith(monthPrefix)).map((b) => b.date)
  ).size;
  const occupancyPct = Math.round((daysBooked / daysInMonth) * 100);

  const monthReservations = allReservations.filter((r) => r.paid && r.checkIn.startsWith(monthPrefix));
  let totalNights = 0;
  let totalEur = 0;
  for (const r of monthReservations) {
    const nights = Math.max(
      1,
      Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000)
    );
    totalNights += nights;
    totalEur += r.priceEur;
  }
  const avgNightlyRateEur = totalNights > 0 ? Math.round(totalEur / totalNights) : 0;

  return { occupancyPct, avgNightlyRateEur, daysBooked, daysInMonth };
}

/* ---------------------------------------------------------------- */
/* Log aktivnosti (samo rezervacije/troškovi) — vidi app/admin/aktivnost. */
/* ---------------------------------------------------------------- */

export async function logActivity(data: {
  adminEmail: string;
  action: string;
  targetLabel: string;
  propertyId: number | null;
}) {
  await db.insert(activityLog).values(data);
}

export async function listRecentActivity(limit = 100) {
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

/* ---------------------------------------------------------------- */
/* Samo-rolani brojač pregleda javnih stranica — vidi app/[slug]/page.tsx */
/* i app/f/[slug]/page.tsx (firme), lib/date.ts todayDateStringZagreb.   */
/* ---------------------------------------------------------------- */

export async function recordPageView(source: "property" | "company", sourceId: number, date: string) {
  await db.insert(pageViews).values({ source, sourceId, date });
}

/** Ukupno pregleda i pregledi zadnjih 30 dana za jednu stranicu. */
export async function getPageViewCounts(source: "property" | "company", sourceId: number, sinceDate: string) {
  const rows = await db
    .select()
    .from(pageViews)
    .where(and(eq(pageViews.source, source), eq(pageViews.sourceId, sourceId)));
  return {
    total: rows.length,
    last30Days: rows.filter((r) => r.date >= sinceDate).length,
  };
}

/**
 * "Put gosta" (funnel) za JEDNU vikendicu: koliko je pregleda stranice u
 * zadanom razdoblju, koliko upita je STVORENO u tom istom razdoblju, koliko
 * rezervacija je STVORENO u tom istom razdoblju — grubi poslovni signal
 * (pregledi → upiti → rezervacije), NE praćenje istog posjetitelja kroz sve
 * korake (nemamo cookie/session praćenje po gostu, namjerno — vidi pageViews
 * komentar u schema.ts). Sva tri broja moraju biti za ISTI period da omjer
 * ima smisla, zato "sinceDate" vrijedi za sve — inače bi npr. "svih upita
 * ikad" protiv "pregleda zadnjih 30 dana" davalo lažno visok/nizak postotak.
 * Napomena: pageViews postoji tek od kad je brojač dodan, pa je omjer
 * pouzdan samo za razdoblje NAKON toga (stariji upiti/rezervacije nemaju
 * odgovarajuće pregleda u bazi) — admin UI ovo objašnjava uz brojke.
 */
export async function getPropertyFunnel(propertyId: number, sinceDate: string) {
  const [viewRows, inquiryRows, reservationRows] = await Promise.all([
    db
      .select()
      .from(pageViews)
      .where(and(eq(pageViews.source, "property"), eq(pageViews.sourceId, propertyId))),
    (async () => {
      try {
        return await db
          .select()
          .from(inquiries)
          .where(and(eq(inquiries.source, "property"), eq(inquiries.sourceId, propertyId)));
      } catch (err) {
        if (isMissingInquiriesTable(err)) return [];
        throw err;
      }
    })(),
    db.select().from(reservations).where(eq(reservations.propertyId, propertyId)),
  ]);
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  return {
    views: viewRows.filter((r) => r.date >= sinceDate).length,
    inquiries: inquiryRows.filter((r) => isoDate(r.createdAt) >= sinceDate).length,
    reservations: reservationRows.filter((r) => isoDate(r.createdAt) >= sinceDate).length,
  };
}
