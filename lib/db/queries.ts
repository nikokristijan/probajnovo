import { eq, ne, desc, asc, and, or, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import {
  todayDateStringZagreb,
  dateStringOffsetFromTodayZagreb,
  currentYearMonthZagreb,
} from "@/lib/date";
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
  subscriptions,
  nfcTags,
  teamTasks,
  taskTemplates,
  teamMessages,
  teamMessageReactions,
  directMessages,
  type NewProperty,
  type NewCompany,
  type NewStudy,
  type NewProduct,
  type NewInquiry,
  type NewPropertyTranslationEn,
  type NewSubscription,
  type NewNfcTag,
  type NewTeamTask,
  type NewTaskTemplate,
  type TeamMessage,
  type NewTeamMessage,
  type NewDirectMessage,
} from "./schema";

const AGENCY_ROW_ID = 1;

/** Stupci agency tablice dodani nakon lansiranja (telefon, Pixel, GA) —
    isti ADD COLUMN IF NOT EXISTS obrazac kao ensureProductColumns. */
async function ensureAgencyColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE agency ADD COLUMN IF NOT EXISTS phone TEXT`);
  await db.execute(sql`ALTER TABLE agency ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT`);
  await db.execute(sql`ALTER TABLE agency ADD COLUMN IF NOT EXISTS ga_measurement_id TEXT`);
}

let agencyColumnsPromise: Promise<void> | null = null;
function ensureAgencyColumnsOnce(): Promise<void> {
  if (!agencyColumnsPromise) {
    agencyColumnsPromise = ensureAgencyColumns().catch((err) => {
      agencyColumnsPromise = null;
      throw err;
    });
  }
  return agencyColumnsPromise;
}

export async function getAgency() {
await ensureAgencyColumnsOnce();
const rows = await db.select().from(agency).where(eq(agency.id, AGENCY_ROW_ID)).limit(1);
return rows[0] ?? null;
}

export async function updateAgency(data: {
heroTitle: string;
officeText: string;
contactEmail: string;
instagramHandle: string;
city: string;
phone: string | null;
metaPixelId: string | null;
gaMeasurementId: string | null;
}) {
await ensureAgencyColumnsOnce();
const [row] = await db
.update(agency)
.set({ ...data, updatedAt: new Date() })
.where(eq(agency.id, AGENCY_ROW_ID))
.returning();
return row;
}

/** Dodaje logo_url/show_novo_branding stupce na properties i companies ako još
    ne postoje (ALTER TABLE ... ADD COLUMN IF NOT EXISTS je siguran za pokretati
    ponovno). Nema ručne SQL migracije ni gumba za nju — vidi ensureBrandingColumnsOnce
    ispod: ovo se automatski pokrene PRIJE svakog upita koji čita/piše properties ili
    companies, pa je live baza uvijek spremna prije nego Drizzle zatraži nove stupce
    (isti duh kao ensurePushSubscriptionsTable, samo bez potrebe za klikom admina). */
async function ensureBrandingColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS logo_url TEXT`);
  await db.execute(
    sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS show_novo_branding BOOLEAN NOT NULL DEFAULT true`
  );
  await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT`);
  await db.execute(
    sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_novo_branding BOOLEAN NOT NULL DEFAULT true`
  );
}

/** Memoizirano po (hladnom startu) serverless instanci — prvi upit koji dotakne
    properties/companies pokrene ALTER TABLE jednom, svi kasniji u istoj instanci
    samo pričekaju isti (već riješeni) promise. Na grešku briše se cache da idući
    poziv smije pokušati ponovno umjesto da ostane trajno "pokvaren". */
let brandingColumnsPromise: Promise<void> | null = null;
function ensureBrandingColumnsOnce(): Promise<void> {
  if (!brandingColumnsPromise) {
    brandingColumnsPromise = ensureBrandingColumns().catch((err) => {
      brandingColumnsPromise = null;
      throw err;
    });
  }
  return brandingColumnsPromise;
}

export async function listProperties({ onlyPublished = false } = {}) {
await ensureBrandingColumnsOnce();
const rows = await db.select().from(properties).orderBy(desc(properties.createdAt));
return onlyPublished ? rows.filter((p) => p.published) : rows;
}

export async function getPropertyBySlug(slug: string) {
await ensureBrandingColumnsOnce();
const rows = await db.select().from(properties).where(eq(properties.slug, slug)).limit(1);
return rows[0] ?? null;
}

export async function getPropertyById(id: number) {
await ensureBrandingColumnsOnce();
const rows = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
return rows[0] ?? null;
}

export async function createProperty(data: NewProperty) {
await ensureBrandingColumnsOnce();
const [row] = await db.insert(properties).values(data).returning();
return row;
}

export async function updateProperty(id: number, data: Partial<NewProperty>) {
await ensureBrandingColumnsOnce();
const [row] = await db
.update(properties)
.set({ ...data, updatedAt: new Date() })
.where(eq(properties.id, id))
.returning();
return row;
}

/** Postoji li tablica u bazi — neke tablice (pretplate, NFC, Portal) nastaju
    tek pri prvom korištenju, pa brisanje ne smije pasti ako ih još nema. */
async function tableExists(name: string): Promise<boolean> {
  const rows = await db.execute<{ ok: boolean }>(sql`SELECT to_regclass(${"public." + name}) IS NOT NULL AS ok`);
  return Boolean(rows[0]?.ok);
}

/**
 * Briše vikendicu ZAJEDNO sa svime što na nju pokazuje (plan #2). Ranije se
 * brisao samo redak vikendice, a rezervacije, troškovi, blokirani dani,
 * pristupi vlasnika, upiti, pregledi i prijevod ostajali su u bazi bez
 * roditelja (nema stranih ključeva). Pretplata se NE briše nego označava
 * "cancelled" da ostane financijska povijest; zadaci iz Portala i dnevnik
 * aktivnosti samo gube poveznicu. Sve u jednoj transakciji.
 */
export async function deleteProperty(id: number) {
  const [hasSubs, hasTasks, hasViews, hasTranslations, hasActivity] = await Promise.all([
    tableExists("subscriptions"),
    tableExists("team_tasks"),
    tableExists("page_views"),
    tableExists("property_translations_en"),
    tableExists("activity_log"),
  ]);
  await db.transaction(async (tx) => {
    await tx.delete(reservations).where(eq(reservations.propertyId, id));
    await tx.delete(expenses).where(eq(expenses.propertyId, id));
    await tx.delete(propertyBlockedDates).where(eq(propertyBlockedDates.propertyId, id));
    await tx.delete(adminAccess).where(eq(adminAccess.propertyId, id));
    await tx.delete(inquiries).where(and(eq(inquiries.source, "property"), eq(inquiries.sourceId, id)));
    if (hasTranslations) await tx.execute(sql`DELETE FROM property_translations_en WHERE property_id = ${id}`);
    if (hasActivity) await tx.execute(sql`UPDATE activity_log SET property_id = NULL WHERE property_id = ${id}`);
    if (hasViews) await tx.execute(sql`DELETE FROM page_views WHERE source = 'property' AND source_id = ${id}`);
    if (hasSubs) await tx.execute(sql`UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE source = 'property' AND source_id = ${id}`);
    if (hasTasks) await tx.execute(sql`UPDATE team_tasks SET property_id = NULL WHERE property_id = ${id}`);
    await tx.delete(properties).where(eq(properties.id, id));
  });
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
    await ensureBrandingColumnsOnce();
    const rows = await db.select().from(companies).orderBy(desc(companies.createdAt));
    return onlyPublished ? rows.filter((c) => c.published) : rows;
  } catch (err) {
    if (isMissingCompaniesTable(err)) return [];
    throw err;
  }
}

export async function getCompanyBySlug(slug: string) {
  try {
    await ensureBrandingColumnsOnce();
    const rows = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingCompaniesTable(err)) return null;
    throw err;
  }
}

export async function getCompanyById(id: number) {
  try {
    await ensureBrandingColumnsOnce();
    const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingCompaniesTable(err)) return null;
    throw err;
  }
}

export async function createCompany(data: NewCompany) {
await ensureBrandingColumnsOnce();
const [row] = await db.insert(companies).values(data).returning();
return row;
}

export async function updateCompany(id: number, data: Partial<NewCompany>) {
await ensureBrandingColumnsOnce();
const [row] = await db
.update(companies)
.set({ ...data, updatedAt: new Date() })
.where(eq(companies.id, id))
.returning();
return row;
}

/** Isto kao deleteProperty (plan #2), za firme. */
export async function deleteCompany(id: number) {
  const [hasSubs, hasTasks, hasViews] = await Promise.all([
    tableExists("subscriptions"),
    tableExists("team_tasks"),
    tableExists("page_views"),
  ]);
  await db.transaction(async (tx) => {
    await tx.delete(adminAccess).where(eq(adminAccess.companyId, id));
    await tx.delete(inquiries).where(and(eq(inquiries.source, "company"), eq(inquiries.sourceId, id)));
    if (hasViews) await tx.execute(sql`DELETE FROM page_views WHERE source = 'company' AND source_id = ${id}`);
    if (hasSubs) await tx.execute(sql`UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE source = 'company' AND source_id = ${id}`);
    if (hasTasks) await tx.execute(sql`UPDATE team_tasks SET company_id = NULL WHERE company_id = ${id}`);
    await tx.delete(companies).where(eq(companies.id, id));
  });
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

/** Dodaje stupce dodane nakon prvog lansiranja `products` (vlastita stranica
    /proizvodi/<slug>, video, kategorija, istaknuto, prilagođen CTA tekst, SEO)
    — isti ALTER TABLE ... ADD COLUMN IF NOT EXISTS obrazac kao
    ensureBrandingColumns, jer products već postoji u produkciji. Unique
    indeks (umjesto UNIQUE na samom stupcu) dopušta više redaka s praznim
    slugom (stariji proizvodi bez vlastite stranice) — Postgres NE tretira
    više NULL vrijednosti kao sukob u unique indeksu. */
async function ensureProductColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT`);
  await db.execute(
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false`
  );
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cta_button_text TEXT`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS faq JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS testimonials JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await db.execute(
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_discounts JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await db.execute(
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS addon_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await db.execute(
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS addon_discount_percent INTEGER NOT NULL DEFAULT 0`
  );
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON products (slug)`
  );
}

let productColumnsPromise: Promise<void> | null = null;
function ensureProductColumnsOnce(): Promise<void> {
  if (!productColumnsPromise) {
    productColumnsPromise = ensureProductColumns().catch((err) => {
      productColumnsPromise = null;
      throw err;
    });
  }
  return productColumnsPromise;
}

export async function listProducts({ onlyPublished = false } = {}) {
await ensureProductColumnsOnce();
const rows = await db.select().from(products).orderBy(asc(products.position), desc(products.createdAt));
return onlyPublished ? rows.filter((p) => p.published) : rows;
}

export async function getProductById(id: number) {
await ensureProductColumnsOnce();
const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
return rows[0] ?? null;
}

/** Za javnu stranicu /proizvodi/[slug] — vlastiti namespace, ne dijeli ga s
    properties/companies/nfcTags (vidi isProductSlugTaken ispod). */
export async function getProductBySlug(slug: string) {
  await ensureProductColumnsOnce();
  const rows = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** Slug provjera SAMO unutar products (vlastiti /proizvodi/<slug> namespace) —
    isti obrazac kao isNfcSlugTaken. */
export async function isProductSlugTaken(slug: string, excludeId?: number) {
  await ensureProductColumnsOnce();
  const rows = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
  return rows.some((r) => r.id !== excludeId);
}

export async function createProduct(data: NewProduct) {
await ensureProductColumnsOnce();
const [row] = await db.insert(products).values(data).returning();
return row;
}

export async function updateProduct(id: number, data: Partial<NewProduct>) {
await ensureProductColumnsOnce();
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

/** Dodaje login_streak_count/last_login_date/theme_preference/
    custom_goal_days/last_seen_at stupce na admin_users ako još ne postoje —
    isti obrazac kao ensureBrandingColumns gore. Prva dva su za Duolingo-stil
    streak, sljedeća dva za vlasničke postavke dashboarda (tamna tema,
    prilagodljiv cilj dana) — vidi updateAdminLoginStreak/updateOwnerTheme/
    updateOwnerCustomGoal niže i app/admin/page.tsx OwnerDashboard.
    last_seen_at je za "Ured" prisutnost tima (Faza 2, app/admin/poruke) —
    vidi updateAdminLastSeen/heartbeatAction i components/admin/
    PresenceHeartbeat.tsx (šalje "otkucaj" svake minute dok je puni admin
    negdje u adminu, ne samo na /admin/poruke). */
async function ensureAdminStreakColumns(): Promise<void> {
  await db.execute(
    sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS login_streak_count INTEGER NOT NULL DEFAULT 0`
  );
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login_date TEXT`);
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS theme_preference TEXT`);
  await db.execute(
    sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS custom_goal_days INTEGER`
  );
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP`);
  // Portal profil (Faza 3, app/admin/portal/profil) — display_name/job_title/bio,
  // vidi komentar uz adminUsers.displayName u schema.ts.
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS display_name TEXT`);
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS job_title TEXT`);
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS bio TEXT`);
  // Slack-stil status (Portal "Ured" oblačić, Faza 4) — vidi komentar uz
  // adminUsers.statusText u schema.ts.
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status_text TEXT`);
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status_emoji TEXT`);
  // Rođendan bez godine (Portal početna, Task #24) — vidi komentar uz
  // adminUsers.birthday u schema.ts.
  await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS birthday TEXT`);
}

let adminStreakColumnsPromise: Promise<void> | null = null;
function ensureAdminStreakColumnsOnce(): Promise<void> {
  if (!adminStreakColumnsPromise) {
    adminStreakColumnsPromise = ensureAdminStreakColumns().catch((err) => {
      adminStreakColumnsPromise = null;
      throw err;
    });
  }
  return adminStreakColumnsPromise;
}

export async function findAdminByEmail(email: string) {
await ensureAdminStreakColumnsOnce();
const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
return rows[0] ?? null;
}

export async function getAdminById(id: number) {
await ensureAdminStreakColumnsOnce();
const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
return rows[0] ?? null;
}

/**
 * Ažurira Duolingo-stil streak (uzastopni dani otvaranja admina) — poziva se
 * SAMO s vlasničkog (role="owner") dashboarda (app/admin/page.tsx
 * OwnerDashboard), punim adminima/superadminima se streak ne prikazuje ni
 * ne broji. Idempotentno unutar istog dana (više posjeta/prefetcheva iste
 * stranice ne broji dvaput) — provjerava lastLoginDate prije pisanja.
 * Ako je zadnja prijava bila JUČER (Europe/Zagreb) → +1, inače (uključujući
 * "nikad") → reset na 1. `isNewToday` govori je li se streak BAŠ SAD
 * promijenio (za konfete/animaciju) — false ako je dashboard već otvoren
 * ranije istog dana.
 */
export async function updateAdminLoginStreak(
  adminId: number
): Promise<{ streak: number; isNewToday: boolean }> {
  await ensureAdminStreakColumnsOnce();
  const admin = await getAdminById(adminId);
  if (!admin) return { streak: 0, isNewToday: false };

  const today = todayDateStringZagreb();
  if (admin.lastLoginDate === today) {
    return { streak: admin.loginStreakCount, isNewToday: false };
  }

  const yesterday = dateStringOffsetFromTodayZagreb(-1);
  const newStreak = admin.lastLoginDate === yesterday ? admin.loginStreakCount + 1 : 1;

  await db
    .update(adminUsers)
    .set({ loginStreakCount: newStreak, lastLoginDate: today })
    .where(eq(adminUsers.id, adminId));

  return { streak: newStreak, isNewToday: true };
}

/** Sprema vlasnikov ručni izbor teme (vidi lib/actions.ts
    updateOwnerThemeAction i components/admin/OwnerThemeToggle.tsx).
    `null` = "prati sustav" (briše eksplicitni izbor). */
export async function updateOwnerTheme(
  adminId: number,
  theme: "light" | "dark" | "system" | null
): Promise<void> {
  await ensureAdminStreakColumnsOnce();
  await db
    .update(adminUsers)
    .set({ themePreference: theme === "system" ? null : theme })
    .where(eq(adminUsers.id, adminId));
}

/** Sprema vlasnikov ručni cilj dana zauzeća za tekući mjesec (vidi
    lib/actions.ts updateOwnerGoalAction i components/admin/
    OwnerGoalEditor.tsx). `null` briše ručni cilj — dashboard se vraća na
    auto-izračunati (70% dana u mjesecu, vidi app/admin/page.tsx). */
export async function updateOwnerCustomGoal(
  adminId: number,
  goalDays: number | null
): Promise<void> {
  await ensureAdminStreakColumnsOnce();
  await db
    .update(adminUsers)
    .set({ customGoalDays: goalDays })
    .where(eq(adminUsers.id, adminId));
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
  const safeSelect = async <T,>(table: string, run: () => Promise<T[]>): Promise<T[]> =>
    (await tableExists(table)) ? run() : [];
  // Novi stupci moraju postojati prije select() * nad agency/products.
  await Promise.all([ensureAgencyColumnsOnce(), ensureProductColumnsOnce()]);
  const [
    agencyRows,
    companyRows,
    studyRows,
    productRows,
    inquiryRows,
    salesRows,
    blockedRows,
    translationRows,
    accessRows,
    adminRows,
    subscriptionRows,
    nfcRows,
  ] = await Promise.all([
    db.select().from(agency),
    db.select().from(companies),
    db.select().from(studies),
    db.select().from(products),
    db.select().from(inquiries),
    db.select().from(sales),
    db.select().from(propertyBlockedDates),
    safeSelect("property_translations_en", () => db.select().from(propertyTranslationsEn)),
    db.select().from(adminAccess),
    // Namjerno BEZ lozinki i 2FA tajni — backup ide mailom.
    db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        isSuperAdmin: adminUsers.isSuperAdmin,
        displayName: adminUsers.displayName,
        jobTitle: adminUsers.jobTitle,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers),
    safeSelect("subscriptions", () => db.select().from(subscriptions)),
    safeSelect("nfc_tags", () => db.select().from(nfcTags)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    // Rezervacije i troškovi po vikendici (kao dosad)...
    properties: perProperty,
    // ...plus sve ostalo što bi trebalo za oporavak (plan #8): kompletan
    // sadržaj stranica, upiti, prodaje, pretplate, NFC, pristupi vlasnika.
    content: {
      agency: agencyRows,
      properties,
      propertyTranslationsEn: translationRows,
      propertyBlockedDates: blockedRows,
      companies: companyRows,
      studies: studyRows,
      products: productRows,
    },
    inquiries: inquiryRows,
    sales: salesRows,
    subscriptions: subscriptionRows,
    nfcTags: nfcRows,
    admins: adminRows,
    adminAccess: accessRows,
  };
}

/* ---------------------------------------------------------------- */
/* Dnevnik automatskih poslova (plan #30) — lib/cron.ts runCron.      */
/* Tablica se stvara sama pri prvom zapisu, kao i ostale "lijene".    */
/* ---------------------------------------------------------------- */

let cronRunsTablePromise: Promise<void> | null = null;
function ensureCronRunsTable(): Promise<void> {
  if (!cronRunsTablePromise) {
    cronRunsTablePromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cron_runs (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          ok BOOLEAN NOT NULL,
          summary TEXT,
          started_at TIMESTAMP NOT NULL,
          finished_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS cron_runs_name_idx ON cron_runs (name, finished_at DESC)`);
    })().catch((err) => {
      cronRunsTablePromise = null;
      throw err;
    });
  }
  return cronRunsTablePromise;
}

export async function recordCronRun(run: { name: string; ok: boolean; summary: string; startedAt: Date }) {
  await ensureCronRunsTable();
  await db.execute(
    sql`INSERT INTO cron_runs (name, ok, summary, started_at) VALUES (${run.name}, ${run.ok}, ${run.summary}, ${run.startedAt.toISOString()})`
  );
  // Čuvamo samo zadnjih ~200 zapisa po poslu — dovoljno za pregled, bez rasta tablice.
  await db.execute(sql`
    DELETE FROM cron_runs WHERE name = ${run.name} AND id NOT IN (
      SELECT id FROM cron_runs WHERE name = ${run.name} ORDER BY id DESC LIMIT 200
    )
  `);
}

export type CronRunRow = {
  name: string;
  ok: boolean;
  summary: string | null;
  startedAt: string;
  finishedAt: string;
  lastOkAt: string | null;
  /** Sati od zadnjeg uspjeha (null = nikad nije uspio). */
  hoursSinceOk: number | null;
  failuresLast7d: number;
};

/** Zadnje pokretanje svakog automatskog posla + kad je zadnji put uspio. */
export async function listLatestCronRuns(): Promise<CronRunRow[]> {
  if (!(await tableExists("cron_runs"))) return [];
  const rows = await db.execute<{
    name: string;
    ok: boolean;
    summary: string | null;
    started_at: string;
    finished_at: string;
    last_ok_at: string | null;
    hours_since_ok: string | number | null;
    failures_7d: string | number;
  }>(sql`
    SELECT DISTINCT ON (r.name)
      r.name, r.ok, r.summary, r.started_at::text AS started_at, r.finished_at::text AS finished_at,
      (SELECT MAX(finished_at)::text FROM cron_runs o WHERE o.name = r.name AND o.ok) AS last_ok_at,
      (SELECT EXTRACT(EPOCH FROM (NOW() - MAX(finished_at))) / 3600 FROM cron_runs o WHERE o.name = r.name AND o.ok) AS hours_since_ok,
      (SELECT COUNT(*) FROM cron_runs f WHERE f.name = r.name AND NOT f.ok AND f.finished_at > NOW() - INTERVAL '7 days') AS failures_7d
    FROM cron_runs r
    ORDER BY r.name, r.finished_at DESC
  `);
  return [...rows].map((r) => ({
    name: r.name,
    ok: r.ok,
    summary: r.summary,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    lastOkAt: r.last_ok_at,
    hoursSinceOk: r.hours_since_ok == null ? null : Number(r.hours_since_ok),
    failuresLast7d: Number(r.failures_7d) || 0,
  }));
}

/* ---------------------------------------------------------------- */
/* Zaključavanje prijave nakon previše krivih pokušaja (plan #5).     */
/* Stupci se namjerno NE dodaju u Drizzle shemu (admin_users se čita  */
/* na puno mjesta bez ensure-a) — koriste se samo ovim sirovim SQL-om. */
/* ---------------------------------------------------------------- */

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

let loginLockColumnsPromise: Promise<void> | null = null;
function ensureLoginLockColumns(): Promise<void> {
  if (!loginLockColumnsPromise) {
    loginLockColumnsPromise = (async () => {
      await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0`);
      await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP`);
    })().catch((err) => {
      loginLockColumnsPromise = null;
      throw err;
    });
  }
  return loginLockColumnsPromise;
}

/** Koliko je još minuta račun zaključan (0 = nije zaključan). */
export async function getLoginLockMinutesLeft(adminId: number): Promise<number> {
  await ensureLoginLockColumns();
  const rows = await db.execute<{ secs: string | number | null }>(
    sql`SELECT EXTRACT(EPOCH FROM (locked_until - NOW())) AS secs FROM admin_users WHERE id = ${adminId} AND locked_until > NOW()`
  );
  const secs = Number(rows[0]?.secs ?? 0);
  return secs > 0 ? Math.ceil(secs / 60) : 0;
}

/** Bilježi krivi pokušaj; nakon LOGIN_MAX_FAILURES zaredom zaključava račun. */
export async function registerFailedLogin(adminId: number): Promise<{ locked: boolean }> {
  await ensureLoginLockColumns();
  const rows = await db.execute<{ failed_login_count: number }>(sql`
    UPDATE admin_users SET
      failed_login_count = failed_login_count + 1,
      locked_until = CASE WHEN failed_login_count + 1 >= ${LOGIN_MAX_FAILURES}
        THEN NOW() + (${LOGIN_LOCK_MINUTES} || ' minutes')::interval ELSE locked_until END
    WHERE id = ${adminId}
    RETURNING failed_login_count
  `);
  const count = Number(rows[0]?.failed_login_count ?? 0);
  if (count >= LOGIN_MAX_FAILURES) {
    await db.execute(sql`UPDATE admin_users SET failed_login_count = 0 WHERE id = ${adminId}`);
    return { locked: true };
  }
  return { locked: false };
}

export async function clearFailedLogins(adminId: number): Promise<void> {
  await ensureLoginLockColumns();
  await db.execute(sql`UPDATE admin_users SET failed_login_count = 0, locked_until = NULL WHERE id = ${adminId}`);
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
  await ensureBrandingColumnsOnce();
  const grants = await getAdminAccessGrants(admin.id);
  const ids = grants.map((g) => g.propertyId).filter((id): id is number => id != null);
  if (ids.length === 0) return [];
  return db.select().from(properties).where(inArray(properties.id, ids));
}

/** Firme na koje ovaj admin ima pristup — isti duh kao listPropertiesForAdmin. */
export async function listCompaniesForAdmin(admin: { id: number; role: string }) {
  if (admin.role !== "owner") return listCompanies();
  await ensureBrandingColumnsOnce();
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

/** Nadolazeće rezervacije PREKO SVIH vikendica, sortirano po dolasku —
    listReservationsForProperty gore vraća samo jednu vikendicu, a widgetu
    "Nadolazeće" na Portal početnoj (Task #24) treba pregled cijele
    agencije na jednom mjestu, s imenom vikendice uz svaku stavku. */
export async function listUpcomingReservations(limit = 8) {
  const today = todayDateStringZagreb();
  return db
    .select({
      id: reservations.id,
      propertyId: reservations.propertyId,
      propertyName: properties.name,
      guestName: reservations.guestName,
      checkIn: reservations.checkIn,
      checkOut: reservations.checkOut,
      guestCount: reservations.guestCount,
    })
    .from(reservations)
    .innerJoin(properties, eq(reservations.propertyId, properties.id))
    .where(gte(reservations.checkIn, today))
    .orderBy(asc(reservations.checkIn))
    .limit(limit);
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

export async function getExpenseById(id: number) {
  const rows = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getReservationById(id: number) {
  const rows = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Uređivanje rezervacije (plan #36) — promjena gosta, datuma, cijene, broja
 * gostiju, kapare ili napomene bez brisanja i ponovnog unosa. Ako su se
 * datumi promijenili, blokirani dani TE rezervacije se ponovno slože (isti
 * dedup kao createReservation: dani koje već drži nešto drugo se preskaču i
 * vraćaju kao overlappingDates za upozorenje). Status plaćanja se ne dira.
 */
export async function updateReservation(
  id: number,
  data: {
    guestName: string;
    phone: string | null;
    email: string | null;
    checkIn: string;
    checkOut: string;
    priceEur: number;
    guestCount: number | null;
    depositEur: number | null;
    note: string | null;
  }
): Promise<{ overlappingDates: string[] }> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(reservations).where(eq(reservations.id, id)).limit(1);
    if (!before) return { overlappingDates: [] };
    await tx.update(reservations).set(data).where(eq(reservations.id, id));
    if (before.checkIn === data.checkIn && before.checkOut === data.checkOut) {
      return { overlappingDates: [] };
    }
    await tx.delete(propertyBlockedDates).where(eq(propertyBlockedDates.reservationId, id));
    const nights = datesInRange(data.checkIn, data.checkOut).slice(0, -1);
    const taken = nights.length
      ? await tx
          .select({ date: propertyBlockedDates.date })
          .from(propertyBlockedDates)
          .where(and(eq(propertyBlockedDates.propertyId, before.propertyId), inArray(propertyBlockedDates.date, nights)))
      : [];
    const takenSet = new Set(taken.map((t) => t.date));
    const free = nights.filter((d) => !takenSet.has(d));
    if (free.length > 0) {
      await tx.insert(propertyBlockedDates).values(
        free.map((date) => ({ propertyId: before.propertyId, date, source: "reservation", reservationId: id }))
      );
    }
    return { overlappingDates: nights.filter((d) => takenSet.has(d)) };
  });
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

const MONTH_ABBR_HR = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];

export type OwnerMonthPoint = {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  daysBooked: number;
  netEur: number;
};

/**
 * Zadnjih `monthsBack` mjeseci (uključujući tekući) zauzetosti i neto zarade
 * preko SVIH zadanih vikendica — za vlasnički dashboard (app/admin/page.tsx
 * OwnerDashboard): trend graf, usporedba s prošlim mjesecom, "najbolji mjesec
 * ikad" provjera i usporedba s istim mjesecom prošle godine. Jedan upit za
 * blokirane datume i jedan za rezervacije/troškove preko cijelog prozora —
 * raspodjela po mjesecu radi se u JS-u, puno jeftinije od monthsBack
 * zasebnih upita (isti duh kao getMonthlyEarnings iznad, samo za više
 * mjeseci odjednom). Poredak: najstariji prvi, tekući mjesec zadnji
 * (trend[trend.length - 1]) — trend[0] je isti mjesec `monthsBack - 1`
 * godina/mjeseci unatrag (npr. monthsBack=13 → trend[0] je isti mjesec
 * prošle godine, za YoY usporedbu).
 */
export async function getOwnerMonthlyTrend(
  propertyIds: number[],
  monthsBack: number
): Promise<OwnerMonthPoint[]> {
  if (propertyIds.length === 0) return [];

  const nowZagreb = currentYearMonthZagreb();
  const points: { year: number; month: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(nowZagreb.year, nowZagreb.month - 1 - i, 1));
    points.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }

  const [allBlocked, allReservations, allExpenses] = await Promise.all([
    db
      .select()
      .from(propertyBlockedDates)
      .where(inArray(propertyBlockedDates.propertyId, propertyIds)),
    db.select().from(reservations).where(inArray(reservations.propertyId, propertyIds)),
    db.select().from(expenses).where(inArray(expenses.propertyId, propertyIds)),
  ]);

  return points.map(({ year, month }) => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const daysBooked = allBlocked.filter((b) => b.date.startsWith(prefix)).length;
    const grossEur = allReservations
      .filter((r) => r.paid && r.checkIn.startsWith(prefix))
      .reduce((sum, r) => sum + r.priceEur, 0);
    const expensesEur = allExpenses
      .filter((e) => e.date.startsWith(prefix))
      .reduce((sum, e) => sum + e.amountEur, 0);
    return {
      year,
      month,
      monthLabel: MONTH_ABBR_HR[month - 1],
      daysBooked,
      netEur: grossEur - expensesEur,
    };
  });
}

/**
 * Raspodjela zauzetosti/neto zarade PO POJEDINOJ vikendici za jedan mjesec —
 * za vlasnički dashboard kad vlasnik ima više vikendica (OwnerPropertyCarousel
 * kartice, "koja vikendica najbolje stoji ovaj mjesec"). Vraća mapu
 * propertyId → { daysBooked, netEur }; vikendica bez ijedne rezervacije/
 * blokade tog mjeseca svejedno dobiva unos s nulama (lakše renderirati bez
 * dodatnih provjera u komponenti).
 */
export async function getPropertiesMonthlyBreakdown(
  propertyIds: number[],
  monthPrefix: string
): Promise<Record<number, { daysBooked: number; netEur: number }>> {
  const result: Record<number, { daysBooked: number; netEur: number }> = {};
  for (const id of propertyIds) result[id] = { daysBooked: 0, netEur: 0 };
  if (propertyIds.length === 0) return result;

  const [allBlocked, allReservations, allExpenses] = await Promise.all([
    db
      .select()
      .from(propertyBlockedDates)
      .where(inArray(propertyBlockedDates.propertyId, propertyIds)),
    db.select().from(reservations).where(inArray(reservations.propertyId, propertyIds)),
    db.select().from(expenses).where(inArray(expenses.propertyId, propertyIds)),
  ]);

  for (const id of propertyIds) {
    const daysBooked = allBlocked.filter(
      (b) => b.propertyId === id && b.date.startsWith(monthPrefix)
    ).length;
    const grossEur = allReservations
      .filter((r) => r.propertyId === id && r.paid && r.checkIn.startsWith(monthPrefix))
      .reduce((sum, r) => sum + r.priceEur, 0);
    const expensesEur = allExpenses
      .filter((e) => e.propertyId === id && e.date.startsWith(monthPrefix))
      .reduce((sum, e) => sum + e.amountEur, 0);
    result[id] = { daysBooked, netEur: grossEur - expensesEur };
  }

  return result;
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

export async function recordPageView(source: "property" | "company" | "product", sourceId: number, date: string) {
  await db.insert(pageViews).values({ source, sourceId, date });
}

/** Pregledi stranica vlasnika od `sinceDate` (plan #43) — zbroj preko svih
    njegovih vikendica/firmi, za "Tvoju stranicu je ovaj tjedan pogledalo…". */
export async function countPageViewsSince(
  targets: { source: "property" | "company"; ids: number[] }[],
  sinceDate: string
): Promise<number> {
  let total = 0;
  for (const t of targets) {
    if (t.ids.length === 0) continue;
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(pageViews)
      .where(and(eq(pageViews.source, t.source), inArray(pageViews.sourceId, t.ids), gte(pageViews.date, sinceDate)));
    total += Number(rows[0]?.n ?? 0);
  }
  return total;
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

/* ---------------------------------------------------------------- */
/* Pretplate NOVO studija (Financije, samo glavni admin/superadmini) — */
/* vidi app/admin/financije i lib/db/schema.ts subscriptions. Tablica */
/* se sama kreira (ensureSubscriptionsTable), isti obrazac kao         */
/* ensurePushSubscriptionsTable — nema pristupa terminalu za ručnu     */
/* migraciju. */
/* ---------------------------------------------------------------- */

/** Kreira `subscriptions` tablicu ako slučajno ne postoji (IF NOT EXISTS je
 * sigurno pozvati i kad tablica već postoji) — vidi ensurePushSubscriptionsTable
 * za isti obrazac. */
export async function ensureSubscriptionsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      source_name TEXT NOT NULL,
      monthly_price_eur INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      is_trial BOOLEAN NOT NULL DEFAULT false,
      trial_ends_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      next_renewal_date TEXT NOT NULL,
      reminder_sent_at TIMESTAMP,
      note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}

let subscriptionsTablePromise: Promise<void> | null = null;
function ensureSubscriptionsTableOnce(): Promise<void> {
  if (!subscriptionsTablePromise) {
    subscriptionsTablePromise = ensureSubscriptionsTable().catch((err) => {
      subscriptionsTablePromise = null;
      throw err;
    });
  }
  return subscriptionsTablePromise;
}

export async function listSubscriptions() {
  await ensureSubscriptionsTableOnce();
  return db.select().from(subscriptions).orderBy(asc(subscriptions.nextRenewalDate));
}

export async function getSubscriptionById(id: number) {
  await ensureSubscriptionsTableOnce();
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSubscription(data: NewSubscription) {
  await ensureSubscriptionsTableOnce();
  const [row] = await db.insert(subscriptions).values(data).returning();
  return row;
}

export async function updateSubscription(id: number, data: Partial<NewSubscription>) {
  await ensureSubscriptionsTableOnce();
  const [row] = await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning();
  return row;
}

export async function deleteSubscription(id: number) {
  await ensureSubscriptionsTableOnce();
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
}

/** "Produži" brzu radnju — pomakne nextRenewalDate za `months` mjeseci
 * naprijed (od danas ako je trenutni datum već prošao, inače od trenutnog
 * nextRenewalDate — da produljenje unaprijed ne skrati sljedeći ciklus),
 * skida trial status (klijent je stvarno platio) i resetira reminderSentAt
 * da idući ciklus opet dobije podsjetnik. */
export async function extendSubscription(id: number, months: number) {
  await ensureSubscriptionsTableOnce();
  const current = await getSubscriptionById(id);
  if (!current) return null;
  const today = todayDateStringZagreb();
  const base = current.nextRenewalDate > today ? current.nextRenewalDate : today;
  const [y, m, d] = base.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + months, d));
  const nextRenewalDate = next.toISOString().slice(0, 10);
  const [row] = await db
    .update(subscriptions)
    .set({
      nextRenewalDate,
      status: "active",
      isTrial: false,
      reminderSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))
    .returning();
  return row;
}

/** Pretplate čiji nextRenewalDate pada unutar sljedećih `daysAhead` dana (ili
 * je već prošao), status "active"/"trial", a podsjetnik još nije poslan —
 * za app/api/cron/reservation-reminders (isti dnevni cron, da se izbjegne
 * novi cron slot). */
export async function listSubscriptionsDueForReminder(daysAhead: number) {
  await ensureSubscriptionsTableOnce();
  const cutoff = dateStringOffsetFromTodayZagreb(daysAhead);
  const all = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ["active", "trial"]),
        isNull(subscriptions.reminderSentAt)
      )
    );
  return all.filter((s) => s.nextRenewalDate <= cutoff);
}

export async function markSubscriptionReminderSent(id: number) {
  await db.update(subscriptions).set({ reminderSentAt: new Date() }).where(eq(subscriptions.id, id));
}

export type SubscriptionStats = {
  mrrEur: number;
  /** Mjesečni iznos probnih pretplata — postaje MRR kad probni period završi. */
  trialMrrEur: number;
  activeCount: number;
  trialCount: number;
  expiringSoonCount: number;
  cancelledCount: number;
};

/** Brojke za stat kartice na vrhu /admin/financije — MRR (zbroj mjesečne
 * cijene svih "active"+"trial" pretplata, probne se broje jer će uskoro
 * postati plaćajuće — vidi napomenu u UI-u), broj aktivnih, broj na
 * probnom periodu, broj koji ističu unutar 7 dana, broj otkazanih. */
export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  const all = await listSubscriptions();
  const cutoff = dateStringOffsetFromTodayZagreb(7);
  const activeCount = all.filter((s) => s.status === "active").length;
  const trialCount = all.filter((s) => s.status === "trial" || s.isTrial).length;
  // Plan #3: MRR su SAMO plaćajuće (aktivne, ne-probne) pretplate. Ranije su
  // se brojale i probne, pa je MRR bio napuhan. Probne su sad zaseban broj
  // (trialMrrEur) — "koliko MRR-a dolazi kad probni periodi završe".
  const mrrEur = all
    .filter((s) => s.status === "active" && !s.isTrial)
    .reduce((sum, s) => sum + s.monthlyPriceEur, 0);
  const trialMrrEur = all
    .filter((s) => s.status === "trial" || (s.status === "active" && s.isTrial))
    .reduce((sum, s) => sum + s.monthlyPriceEur, 0);
  const expiringSoonCount = all.filter(
    (s) => (s.status === "active" || s.status === "trial") && s.nextRenewalDate <= cutoff
  ).length;
  const cancelledCount = all.filter((s) => s.status === "cancelled").length;
  return { mrrEur, trialMrrEur, activeCount, trialCount, expiringSoonCount, cancelledCount };
}

/** Broj NOVIH pretplata (po startDate) po mjesecu za `year` (12 brojeva,
 * siječanj→prosinac) — za YearlyBarChart na /admin/financije, isti obrazac
 * kao getSalesYearlyByMonth. */
export async function getSubscriptionsYearlyByMonth(year: number) {
  const all = await listSubscriptions();
  const totals = Array(12).fill(0) as number[];
  for (const s of all) {
    if (!s.startDate.startsWith(String(year))) continue;
    const monthIdx = Number(s.startDate.slice(5, 7)) - 1;
    if (monthIdx >= 0 && monthIdx < 12) totals[monthIdx] += 1;
  }
  return totals;
}

/** Isto kao getSubscriptionsYearlyByMonth, ali zbraja monthlyPriceEur
 * (vrijednost) umjesto brojanja pretplata — za spojeni "Financije" pregled
 * (vidi app/admin/financije), gdje se ovo zbraja s getSalesYearlyByMonth u
 * JEDAN graf ukupnog prometa agencije po mjesecu. NAPOMENA: ovo je "nova
 * potpisana mjesečna vrijednost" (koliko je NOVIH pretplata vrijedilo u
 * mjesecu kad su počele), ne stvarno naplaćeni iznos taj mjesec — prava
 * mjesečna naplata bi trebala priznavati SVAKI mjesec dok je pretplata
 * aktivna, što bi tražilo puni ledger po ciklusu naplate (nema ga u
 * shemi). Ovo je namjerno jednostavna, iskrena aproksimacija u istom duhu
 * kao "nove pretplate" graf koji je već postojao — samo u eurima umjesto
 * broja, da se može zbrojiti s prodajom. */
export async function getSubscriptionsValueYearlyByMonth(year: number) {
  const all = await listSubscriptions();
  const totals = Array(12).fill(0) as number[];
  for (const s of all) {
    if (!s.startDate.startsWith(String(year))) continue;
    const monthIdx = Number(s.startDate.slice(5, 7)) - 1;
    if (monthIdx >= 0 && monthIdx < 12) totals[monthIdx] += s.monthlyPriceEur;
  }
  return totals;
}

/* ---------------------------------------------------------------- */
/* NFC oznake (gost-facing WiFi stranica za fizičku NFC pločicu) —    */
/* vidi lib/db/schema.ts nfcTags i app/nfc/[slug]/page.tsx. Tablica   */
/* se sama kreira (ensureNfcTagsTable), isti obrazac kao              */
/* ensureSubscriptionsTable — nema pristupa terminalu za ručnu        */
/* migraciju.                                                         */
/* ---------------------------------------------------------------- */

/** Kreira `nfc_tags` tablicu ako slučajno ne postoji (IF NOT EXISTS je
 * sigurno pozvati i kad tablica već postoji) — vidi ensureSubscriptionsTable
 * za isti obrazac. */
export async function ensureNfcTagsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nfc_tags (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      wifi_ssid TEXT NOT NULL,
      wifi_password TEXT,
      welcome_title TEXT,
      welcome_text TEXT,
      image TEXT,
      accent_color TEXT NOT NULL DEFAULT '#B5502E',
      published BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}

/** Dodaje opcionalne gost-facing stupce dodane nakon prvog lansiranja
    nfc_tags (Google recenzije, društvene mreže, kontakt telefon, kućni red,
    lokalne preporuke) — isti ALTER TABLE ... ADD COLUMN IF NOT EXISTS obrazac
    kao ensureBrandingColumns, jer nfc_tags već postoji u produkciji pa CREATE
    TABLE IF NOT EXISTS iznad ne bi ništa dodao postojećoj tablici. Svih pet
    su OPCIONALNI — vidi komentar uz ova polja u schema.ts. */
async function ensureNfcExtraColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS google_review_url TEXT`);
  await db.execute(sql`ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS social_url TEXT`);
  await db.execute(sql`ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS contact_phone TEXT`);
  await db.execute(sql`ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS house_rules_text TEXT`);
  await db.execute(sql`ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS local_tips_text TEXT`);
}

let nfcTagsTablePromise: Promise<void> | null = null;
function ensureNfcTagsTableOnce(): Promise<void> {
  if (!nfcTagsTablePromise) {
    nfcTagsTablePromise = (async () => {
      await ensureNfcTagsTable();
      await ensureNfcExtraColumns();
    })().catch((err) => {
      nfcTagsTablePromise = null;
      throw err;
    });
  }
  return nfcTagsTablePromise;
}

export async function listNfcTags() {
  await ensureNfcTagsTableOnce();
  return db.select().from(nfcTags).orderBy(desc(nfcTags.createdAt));
}

export async function getNfcTagById(id: number) {
  await ensureNfcTagsTableOnce();
  const rows = await db.select().from(nfcTags).where(eq(nfcTags.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Za gost-facing /nfc/[slug] — samo objavljene pločice su dohvatljive
    (isti duh kao getPropertyBySlug + provjera `published` u page.tsx). */
export async function getNfcTagBySlug(slug: string) {
  await ensureNfcTagsTableOnce();
  const rows = await db.select().from(nfcTags).where(eq(nfcTags.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** Slug provjera SAMO unutar nfc_tags (vlastiti /nfc/<slug> namespace, ne
    dijeli ga s properties/companies — vidi komentar uz nfcTags u schema.ts). */
export async function isNfcSlugTaken(slug: string, excludeId?: number) {
  await ensureNfcTagsTableOnce();
  const rows = await db.select({ id: nfcTags.id }).from(nfcTags).where(eq(nfcTags.slug, slug));
  return rows.some((r) => r.id !== excludeId);
}

export async function createNfcTag(data: NewNfcTag) {
  await ensureNfcTagsTableOnce();
  const [row] = await db.insert(nfcTags).values(data).returning();
  return row;
}

export async function updateNfcTag(id: number, data: Partial<NewNfcTag>) {
  await ensureNfcTagsTableOnce();
  const [row] = await db
    .update(nfcTags)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(nfcTags.id, id))
    .returning();
  return row;
}

export async function deleteNfcTag(id: number) {
  await ensureNfcTagsTableOnce();
  await db.delete(nfcTags).where(eq(nfcTags.id, id));
}

/* ---------------------------------------------------------------- */
/* FAZA 2 — tim: zadaci + interni feed poruka (app/admin/zadaci,      */
/* app/admin/poruke). Vidi opsežan komentar uz teamTasks/teamMessages */
/* u lib/db/schema.ts. Tablice se same kreiraju pri prvom upitu, isti */
/* obrazac kao ensureSubscriptionsTable/ensureNfcTagsTable gore —     */
/* nema pristupa terminalu za ručnu migraciju. */
/* ---------------------------------------------------------------- */

export async function ensureTeamTasksTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'normal',
      assigned_to_email TEXT,
      created_by_email TEXT NOT NULL,
      property_id INTEGER,
      company_id INTEGER,
      due_date TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      completed_at TIMESTAMP
    )
  `);
}

let teamTasksTablePromise: Promise<void> | null = null;
function ensureTeamTasksTableOnce(): Promise<void> {
  if (!teamTasksTablePromise) {
    teamTasksTablePromise = ensureTeamTasksTable().catch((err) => {
      teamTasksTablePromise = null;
      throw err;
    });
  }
  return teamTasksTablePromise;
}

export async function ensureTeamMessagesTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_messages (
      id SERIAL PRIMARY KEY,
      admin_email TEXT NOT NULL,
      body TEXT NOT NULL,
      task_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  // Prikvačivanje poruka (Portal Faza 5) — isti ALTER TABLE ... ADD COLUMN
  // IF NOT EXISTS obrazac kao ensureAdminStreakColumns, vidi komentar uz
  // teamMessages.pinnedAt u schema.ts.
  await db.execute(sql`ALTER TABLE team_messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE team_messages ADD COLUMN IF NOT EXISTS pinned_by_email TEXT`);
}

let teamMessagesTablePromise: Promise<void> | null = null;
function ensureTeamMessagesTableOnce(): Promise<void> {
  if (!teamMessagesTablePromise) {
    teamMessagesTablePromise = ensureTeamMessagesTable().catch((err) => {
      teamMessagesTablePromise = null;
      throw err;
    });
  }
  return teamMessagesTablePromise;
}

/** Emoji reakcije (Portal Faza 5) — vidi opsežan komentar uz
    teamMessageReactions u lib/db/schema.ts. UNIQUE sprječava duplu reakciju
    istog admina istim emojijem na istu poruku (toggleTeamMessageReaction
    ionako provjerava postojanje prije umetanja, UNIQUE je samo dodatna
    mreža za slučaj dvostrukog klika/utrke zahtjeva). */
export async function ensureTeamMessageReactionsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_message_reactions (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL,
      admin_email TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      UNIQUE (message_id, admin_email, emoji)
    )
  `);
}

let teamMessageReactionsTablePromise: Promise<void> | null = null;
function ensureTeamMessageReactionsTableOnce(): Promise<void> {
  if (!teamMessageReactionsTablePromise) {
    teamMessageReactionsTablePromise = ensureTeamMessageReactionsTable().catch((err) => {
      teamMessageReactionsTablePromise = null;
      throw err;
    });
  }
  return teamMessageReactionsTablePromise;
}

/** Cijeli tim (puni admini + superadmini) za dodjelu zadataka/prikaz autora
    poruka/"Ured" prisutnost — NAMJERNO isključuje role="owner" (vlasnici
    nisu dio agencijskog tima, vidi standing rule uz requireAdmin u
    lib/actions.ts). ensureAdminStreakColumnsOnce garantira da last_seen_at
    postoji prije nego se pročita (select() vraća SVE stupce). */
export async function listTeamMembers() {
  await ensureAdminStreakColumnsOnce();
  return db.select().from(adminUsers).where(ne(adminUsers.role, "owner")).orderBy(asc(adminUsers.email));
}

/** "Otkucaj" prisutnosti (PresenceHeartbeat.tsx) — samo ažurira
    last_seen_at, ne baca grešku ako admin u međuvremenu ne postoji (npr.
    obrisan dok mu je tab ostao otvoren). */
export async function updateAdminLastSeen(adminId: number): Promise<void> {
  await ensureAdminStreakColumnsOnce();
  await db.update(adminUsers).set({ lastSeenAt: new Date() }).where(eq(adminUsers.id, adminId));
}

/** Svi zadaci, najnoviji prvi — app/admin/zadaci grupira u 3 stupca (todo/
    in_progress/done) na strani stranice, ovdje samo jedan upit. */
export async function listTeamTasks() {
  await ensureTeamTasksTableOnce();
  return db.select().from(teamTasks).orderBy(desc(teamTasks.createdAt));
}

export async function getTeamTaskById(id: number) {
  await ensureTeamTasksTableOnce();
  const rows = await db.select().from(teamTasks).where(eq(teamTasks.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createTeamTask(data: NewTeamTask) {
  await ensureTeamTasksTableOnce();
  const [row] = await db.insert(teamTasks).values(data).returning();
  return row;
}

/** status: "todo" | "in_progress" | "done" — completedAt se postavlja/briše
    ovdje (ne u pozivatelju) da se ne zaboravi kod budućih poziva. */
export async function updateTeamTaskStatus(id: number, status: string) {
  await ensureTeamTasksTableOnce();
  const [row] = await db
    .update(teamTasks)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(eq(teamTasks.id, id))
    .returning();
  return row;
}

/** email = null briše dodjelu (vraća zadatak u "za preuzeti"). */
export async function assignTeamTask(id: number, email: string | null) {
  await ensureTeamTasksTableOnce();
  const [row] = await db
    .update(teamTasks)
    .set({ assignedToEmail: email })
    .where(eq(teamTasks.id, id))
    .returning();
  return row;
}

export async function deleteTeamTask(id: number) {
  await ensureTeamTasksTableOnce();
  await db.delete(teamTasks).where(eq(teamTasks.id, id));
  // Komentari vezani uz obrisan zadatak ostaju u glavnom feedu kao opće
  // poruke (taskId veza jednostavno postane "viseća") — namjerno se ne
  // brišu, poruka je i dalje čitljiva ("dogovorili smo se da...").
}

/** Predlošci zadataka (Portal, "task templates") — vidi opsežan komentar uz
    taskTemplates u lib/db/schema.ts. Isti self-creating obrazac kao ostale
    Faza 2+ tablice, nema pristupa terminalu za ručnu migraciju. */
export async function ensureTaskTemplatesTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS task_templates (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      created_by_email TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}

let taskTemplatesTablePromise: Promise<void> | null = null;
function ensureTaskTemplatesTableOnce(): Promise<void> {
  if (!taskTemplatesTablePromise) {
    taskTemplatesTablePromise = ensureTaskTemplatesTable().catch((err) => {
      taskTemplatesTablePromise = null;
      throw err;
    });
  }
  return taskTemplatesTablePromise;
}

/** Najnoviji prvi — prikazano kao brzi gumbi iznad TeamTaskForm (vidi
    TeamTaskForm.tsx), isti poredak kao listTeamTasks. */
export async function listTaskTemplates() {
  await ensureTaskTemplatesTableOnce();
  return db.select().from(taskTemplates).orderBy(desc(taskTemplates.createdAt));
}

export async function createTaskTemplate(data: NewTaskTemplate) {
  await ensureTaskTemplatesTableOnce();
  const [row] = await db.insert(taskTemplates).values(data).returning();
  return row;
}

export async function deleteTaskTemplate(id: number) {
  await ensureTaskTemplatesTableOnce();
  await db.delete(taskTemplates).where(eq(taskTemplates.id, id));
}

/** Opći feed (app/admin/poruke) — samo poruke BEZ taskId, kronološki
    (najstarije prvo, kao chat). limit brani od neograničenog rasta upita
    na vrlo aktivnom timu. */
export async function listTeamMessages(limit = 200) {
  await ensureTeamMessagesTableOnce();
  const rows = await db
    .select()
    .from(teamMessages)
    .where(isNull(teamMessages.taskId))
    .orderBy(desc(teamMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

/** Komentari ispod jednog zadatka (app/admin/zadaci), kronološki. */
export async function listTaskComments(taskId: number) {
  await ensureTeamMessagesTableOnce();
  return db
    .select()
    .from(teamMessages)
    .where(eq(teamMessages.taskId, taskId))
    .orderBy(asc(teamMessages.createdAt));
}

/** Komentari za više zadataka odjednom (plan #63) — jedan upit za cijelu
    ploču umjesto po zadatku. */
export async function listCommentsForTasks(taskIds: number[]) {
  if (taskIds.length === 0) return [];
  await ensureTeamMessagesTableOnce();
  return db
    .select()
    .from(teamMessages)
    .where(inArray(teamMessages.taskId, taskIds))
    .orderBy(asc(teamMessages.createdAt));
}

export async function createTeamMessage(data: NewTeamMessage) {
  await ensureTeamMessagesTableOnce();
  const [row] = await db.insert(teamMessages).values(data).returning();
  return row;
}

/* ---------------------------------------------------------------- */
/* Portal Faza 5 — @spominjanja, emoji reakcije, prikvačivanje u tim  */
/* kanalu (TeamChannelThread.tsx). Spominjanja NEMAJU poseban stupac  */
/* — otkrivaju se pri renderiranju iz body teksta prema roster popisu */
/* (isti minimalistički pristup kao ostatak Faze 2/3, bez dodatne     */
/* tablice/notifikacijskog sustava za jednostavan tim od par ljudi).  */
/* ---------------------------------------------------------------- */

export type ChannelMessageReaction = { emoji: string; count: number; mine: boolean };
export type ChannelMessageView = TeamMessage & { reactions: ChannelMessageReaction[] };

/** Sirovi retci reakcija za zadan popis poruka — grupiranje po (poruka,
    emoji) radi se u pozivatelju (listTeamMessagesWithReactions), da upit
    ovdje ostane jednostavan jedan SELECT ... WHERE message_id IN (...). */
export async function listReactionsForMessages(messageIds: number[]) {
  await ensureTeamMessageReactionsTableOnce();
  if (messageIds.length === 0) return [];
  return db.select().from(teamMessageReactions).where(inArray(teamMessageReactions.messageId, messageIds));
}

/** Opći tim kanal + grupirane reakcije po poruci, spremno za JSON odgovor
    (GET /api/admin/portal/messages) i početni server-render (app/admin/
    portal/page.tsx) — ista oblik podataka na oba mjesta da TeamChannelThread
    ne mora razlikovati "prvi render" od "poslije pollinga". currentEmail
    postavlja "mine" zastavicu (moja reakcija = narančasto popunjena, klik
    je toggle/ukloni umjesto dodaj). */
export async function listTeamMessagesWithReactions(currentEmail: string, limit = 200): Promise<ChannelMessageView[]> {
  const messages = await listTeamMessages(limit);
  if (messages.length === 0) return [];
  const reactionRows = await listReactionsForMessages(messages.map((m) => m.id));
  const byMessage = new Map<number, Map<string, ChannelMessageReaction>>();
  for (const r of reactionRows) {
    let byEmoji = byMessage.get(r.messageId);
    if (!byEmoji) {
      byEmoji = new Map();
      byMessage.set(r.messageId, byEmoji);
    }
    const cur = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    cur.count += 1;
    if (r.adminEmail === currentEmail) cur.mine = true;
    byEmoji.set(r.emoji, cur);
  }
  return messages.map((m) => ({
    ...m,
    reactions: Array.from(byMessage.get(m.id)?.values() ?? []),
  }));
}

/** Klik na emoji = toggle (drugi klik istog admina istim emojijem uklanja
    reakciju umjesto da dodaje drugu) — isto ponašanje kao Slack/Teams. */
export async function toggleTeamMessageReaction(
  messageId: number,
  adminEmail: string,
  emoji: string
): Promise<"added" | "removed"> {
  await ensureTeamMessageReactionsTableOnce();
  const existing = await db
    .select()
    .from(teamMessageReactions)
    .where(
      and(
        eq(teamMessageReactions.messageId, messageId),
        eq(teamMessageReactions.adminEmail, adminEmail),
        eq(teamMessageReactions.emoji, emoji)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db.delete(teamMessageReactions).where(eq(teamMessageReactions.id, existing[0].id));
    return "removed";
  }
  await db.insert(teamMessageReactions).values({ messageId, adminEmail, emoji });
  return "added";
}

/** Prikvači/otkvači poruku u općem kanalu (task komentari se ne prikvačuju
    — pinnedAt/pinnedByEmail postoje na svim porukama, ali UI za njih postoji
    samo u TeamChannelThread.tsx). Baca ako poruka ne postoji (obrisana
    ranije/pogrešan id iz zastarjelog pollanog odgovora — pozivatelj hvata
    grešku i samo osvježi popis, vidi TeamChannelThread.tsx handleTogglePin). */
export async function toggleTeamMessagePin(messageId: number, adminEmail: string): Promise<"pinned" | "unpinned"> {
  await ensureTeamMessagesTableOnce();
  const rows = await db.select().from(teamMessages).where(eq(teamMessages.id, messageId)).limit(1);
  const msg = rows[0];
  if (!msg) throw new Error("Poruka ne postoji (možda je već obrisana).");
  if (msg.pinnedAt) {
    await db.update(teamMessages).set({ pinnedAt: null, pinnedByEmail: null }).where(eq(teamMessages.id, messageId));
    return "unpinned";
  }
  await db.update(teamMessages).set({ pinnedAt: new Date(), pinnedByEmail: adminEmail }).where(eq(teamMessages.id, messageId));
  return "pinned";
}

/* ---------------------------------------------------------------- */
/* Portal (Faza 3) — direktno dopisivanje + profil + statistika,      */
/* nadovezuje se na Fazu 2 (zadaci/poruke) iznad. Ista "self-healing" */
/* shema kao ostatak datoteke — tablica se sama kreira pri prvom      */
/* upitu, nema pristupa terminalu za ručnu migraciju. */
/* ---------------------------------------------------------------- */

export async function ensureDirectMessagesTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id SERIAL PRIMARY KEY,
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      body TEXT NOT NULL,
      read_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}

let directMessagesTablePromise: Promise<void> | null = null;
function ensureDirectMessagesTableOnce(): Promise<void> {
  if (!directMessagesTablePromise) {
    directMessagesTablePromise = ensureDirectMessagesTable().catch((err) => {
      directMessagesTablePromise = null;
      throw err;
    });
  }
  return directMessagesTablePromise;
}

/** Razgovor između dvoje admina, kronološki (najstarije prvo, kao chat) —
    simetrično (A→B i B→A u istoj niti), isti princip kao WhatsApp/Messenger
    1:1 niti. limit brani od neograničenog rasta na vrlo aktivnom razgovoru. */
export async function listDirectMessages(emailA: string, emailB: string, limit = 300) {
  await ensureDirectMessagesTableOnce();
  const rows = await db
    .select()
    .from(directMessages)
    .where(
      or(
        and(eq(directMessages.fromEmail, emailA), eq(directMessages.toEmail, emailB)),
        and(eq(directMessages.fromEmail, emailB), eq(directMessages.toEmail, emailA))
      )
    )
    .orderBy(desc(directMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function createDirectMessage(data: NewDirectMessage) {
  await ensureDirectMessagesTableOnce();
  const [row] = await db.insert(directMessages).values(data).returning();
  return row;
}

/** Označava SVE poruke koje je `viewerEmail` primio od `otherEmail` kao
    pročitane — poziva se čim viewer otvori tu nit (vidi
    app/admin/portal/dm/[email]/page.tsx). */
export async function markDirectMessagesRead(viewerEmail: string, otherEmail: string): Promise<void> {
  await ensureDirectMessagesTableOnce();
  await db
    .update(directMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(directMessages.fromEmail, otherEmail),
        eq(directMessages.toEmail, viewerEmail),
        isNull(directMessages.readAt)
      )
    );
}

/** Popis razgovora za Portal sidebar — jedan redak po sugovorniku s kojim
    viewer ima BAREM jednu poruku (u bilo kojem smjeru), zadnja poruka +
    broj nepročitanih od tog sugovornika, sortirano po zadnjoj aktivnosti
    (najnovije prvo). Sirovi SQL (ne Drizzle query builder) jer je ovo
    agregacija po "drugoj strani" niti — jednostavnije napisati kao dva
    UNION-ana upita nego graditi kroz builder. */
export async function listDmConversations(
  viewerEmail: string
): Promise<{ email: string; lastBody: string; lastAt: Date; unreadCount: number }[]> {
  await ensureDirectMessagesTableOnce();
  const result = await db.execute<{
    counterpart: string;
    last_body: string;
    last_at: Date;
    unread_count: string;
  }>(sql`
    WITH thread AS (
      SELECT
        CASE WHEN from_email = ${viewerEmail} THEN to_email ELSE from_email END AS counterpart,
        body,
        created_at,
        (to_email = ${viewerEmail} AND read_at IS NULL) AS is_unread
      FROM direct_messages
      WHERE from_email = ${viewerEmail} OR to_email = ${viewerEmail}
    ),
    latest AS (
      SELECT DISTINCT ON (counterpart) counterpart, body AS last_body, created_at AS last_at
      FROM thread
      ORDER BY counterpart, created_at DESC
    ),
    unread AS (
      SELECT counterpart, COUNT(*) AS unread_count
      FROM thread
      WHERE is_unread
      GROUP BY counterpart
    )
    SELECT latest.counterpart, latest.last_body, latest.last_at, COALESCE(unread.unread_count, 0) AS unread_count
    FROM latest
    LEFT JOIN unread ON unread.counterpart = latest.counterpart
    ORDER BY latest.last_at DESC
  `);
  return result.map((r) => ({
    email: r.counterpart,
    lastBody: r.last_body,
    lastAt: new Date(r.last_at),
    unreadCount: Number(r.unread_count),
  }));
}

/** Ukupan broj nepročitanih DM-ova za viewera (preko svih razgovora) — za
    značku uz "Portal" link u izborniku, vidi app/admin/layout.tsx. */
export async function countUnreadDirectMessages(viewerEmail: string): Promise<number> {
  await ensureDirectMessagesTableOnce();
  const rows = await db
    .select()
    .from(directMessages)
    .where(and(eq(directMessages.toEmail, viewerEmail), isNull(directMessages.readAt)));
  return rows.length;
}

/** Sprema Portal profil (ime/titula/bio/rođendan) — vidi
    app/admin/portal/profil/[email]/page.tsx i updateAdminProfileAction. */
export async function updateAdminProfile(
  adminId: number,
  data: { displayName: string | null; jobTitle: string | null; bio: string | null; birthday: string | null }
): Promise<void> {
  await ensureAdminStreakColumnsOnce();
  await db.update(adminUsers).set(data).where(eq(adminUsers.id, adminId));
}

/** Sprema/briše Slack-stil status (Portal "Ured", Faza 4) — vidi
    updateAdminStatusAction i komentar uz adminUsers.statusText u schema.ts. */
export async function updateAdminStatus(
  adminId: number,
  data: { statusText: string | null; statusEmoji: string | null }
): Promise<void> {
  await ensureAdminStreakColumnsOnce();
  await db.update(adminUsers).set(data).where(eq(adminUsers.id, adminId));
}

/** Broj poruka (opći feed, taskId null) po danu (Europe/Zagreb) za zadnjih
    `days` dana — za aktivnost graf u Portalu (vidi TeamActivityChart).
    Uvijek vraća `days` točaka, popunjeno nulama gdje nema poruka, kronološki
    (najstariji dan prvi) — isti "uvijek pun niz" obrazac kao
    getOwnerMonthlyTrend. */
export async function getTeamMessageCountsByDay(days = 7): Promise<{ dateKey: string; count: number }[]> {
  await ensureTeamMessagesTableOnce();
  const result = await db.execute<{ day: string; count: string }>(sql`
    SELECT to_char(created_at AT TIME ZONE 'Europe/Zagreb', 'YYYY-MM-DD') AS day, COUNT(*) AS count
    FROM team_messages
    WHERE task_id IS NULL
      AND created_at >= now() - (${days}::text || ' days')::interval
    GROUP BY day
  `);
  const countByDay = new Map(result.map((r) => [r.day, Number(r.count)]));
  const out: { dateKey: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateKey = dateStringOffsetFromTodayZagreb(-i);
    out.push({ dateKey, count: countByDay.get(dateKey) ?? 0 });
  }
  return out;
}

/** Broj zadataka po statusu (todo/in_progress/done) — za donut graf u
    Portalu. */
export async function getTeamTaskStatusCounts(): Promise<{ status: string; count: number }[]> {
  await ensureTeamTasksTableOnce();
  const result = await db.execute<{ status: string; count: string }>(sql`
    SELECT status, COUNT(*) AS count FROM team_tasks GROUP BY status
  `);
  return result.map((r) => ({ status: r.status, count: Number(r.count) }));
}

/** Broj DOVRŠENIH zadataka po dodijeljenom adminu — za "tko je koliko
    završio" stupčasti graf u Portalu. Namjerno isključuje nedodijeljene
    (assigned_to_email IS NULL) — nema smisla u grafu "po osobi". */
export async function getTeamTaskCompletionByAdmin(): Promise<{ email: string; count: number }[]> {
  await ensureTeamTasksTableOnce();
  const result = await db.execute<{ assigned_to_email: string; count: string }>(sql`
    SELECT assigned_to_email, COUNT(*) AS count
    FROM team_tasks
    WHERE status = 'done' AND assigned_to_email IS NOT NULL
    GROUP BY assigned_to_email
    ORDER BY count DESC
  `);
  return result.map((r) => ({ email: r.assigned_to_email, count: Number(r.count) }));
}

/** "Tjedna ljestvica" za Ured (v8, na izričit zahtjev "tjedna liga tko je
    najviše radio") — jednostavan zbrojeni "bodovni" prikaz zadnjih 7 dana:
    dovršen zadatak vrijedi 3 boda (teži rad), poslana poruka (tim kanal ili
    DM) 1 bod. Namjerno NIJE mjerenje stvarno provedenog vremena (last_seen_at
    čuva samo ZADNJI otkucaj, ne povijest) — ovo je "koliko se tko vidjelo da
    doprinosi timu ovaj tjedan", isti duh kao GitHub contribution graf, ne
    precizan sat/minuta obračun. Prazno/bez ijedne akcije = admin se ne
    pojavljuje u ljestvici (nema smisla prikazati 0 među aktivnima). */
/**
 * Tjedna ljestvica (plan #70) — ranije je svaka poruka vrijedila bod pa je
 * ljestvica nagrađivala spam. Sad se boduje stvarni rad:
 *  - završen zadatak 5 (+2 ako je visokog prioriteta, +1 ako je u roku),
 *  - odgovor gostu na upit iz admina 3, nova rezervacija 2,
 *  - poruke (tim + DM) najviše 5 bodova po danu.
 */
export async function getWeeklyLeaderboard(): Promise<{ email: string; score: number }[]> {
  await Promise.all([ensureTeamTasksTableOnce(), ensureTeamMessagesTableOnce(), ensureDirectMessagesTableOnce()]);
  const hasActivity = await tableExists("activity_log");
  const activityPart = hasActivity
    ? sql`
      UNION ALL
      SELECT a.admin_email AS email,
        SUM(CASE a.action WHEN 'replied_inquiry' THEN 3 WHEN 'created_reservation' THEN 2 ELSE 0 END) AS pts
      FROM activity_log a
      JOIN admin_users u ON u.email = a.admin_email AND u.role <> 'owner'
      WHERE a.created_at >= now() - interval '7 days'
      GROUP BY a.admin_email`
    : sql``;
  const result = await db.execute<{ email: string; score: string }>(sql`
    WITH chat AS (
      SELECT admin_email AS email, created_at::date AS d FROM team_messages
      WHERE created_at >= now() - interval '7 days'
      UNION ALL
      SELECT from_email AS email, created_at::date AS d FROM direct_messages
      WHERE created_at >= now() - interval '7 days'
    ),
    scores AS (
      SELECT assigned_to_email AS email,
        SUM(5
          + CASE WHEN priority = 'high' THEN 2 ELSE 0 END
          + CASE WHEN due_date IS NOT NULL AND due_date <> '' AND completed_at::date <= due_date::date THEN 1 ELSE 0 END
        ) AS pts
      FROM team_tasks
      WHERE status = 'done' AND completed_at >= now() - interval '7 days' AND assigned_to_email IS NOT NULL
      GROUP BY assigned_to_email
      UNION ALL
      SELECT email, SUM(LEAST(n, 5)) AS pts
      FROM (SELECT email, d, COUNT(*) AS n FROM chat GROUP BY email, d) per_day
      GROUP BY email
      ${activityPart}
    )
    SELECT email, SUM(pts)::int AS score
    FROM scores
    GROUP BY email
    HAVING SUM(pts) > 0
    ORDER BY score DESC
    LIMIT 5
  `);
  return result.map((r) => ({ email: r.email, score: Number(r.score) }));
}

/* ================================================================ */
/* FAZA 2 — superadmin (plan #12–#27)                                */
/* ================================================================ */

/* ---------------------------------------------------------------- */
/* Pozivnice e-mailom (plan #13). Novi admin/vlasnik ne dobiva         */
/* lozinku porukom — dobiva link s jednokratnim tokenom i sam postavi  */
/* lozinku. U bazi je samo SHA-256 hash tokena, nikad sam token.       */
/* Isti link služi i kao "postavi novu lozinku" kad netko zaboravi.    */
/* ---------------------------------------------------------------- */

export const INVITE_VALID_DAYS = 7;

let inviteColumnsPromise: Promise<void> | null = null;
function ensureInviteColumns(): Promise<void> {
  if (!inviteColumnsPromise) {
    inviteColumnsPromise = (async () => {
      await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_token_hash TEXT`);
      await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP`);
    })().catch((err) => {
      inviteColumnsPromise = null;
      throw err;
    });
  }
  return inviteColumnsPromise;
}

export async function setAdminInvite(adminId: number, tokenHash: string): Promise<void> {
  await ensureInviteColumns();
  await db.execute(sql`
    UPDATE admin_users SET
      invite_token_hash = ${tokenHash},
      invite_expires_at = NOW() + (${INVITE_VALID_DAYS} || ' days')::interval,
      invite_sent_at = NOW()
    WHERE id = ${adminId}
  `);
}

/** Admin kojemu pripada (još važeći) token pozivnice, ili null. */
export async function findAdminByInviteHash(tokenHash: string) {
  await ensureInviteColumns();
  const rows = await db.execute<{ id: number }>(
    sql`SELECT id FROM admin_users WHERE invite_token_hash = ${tokenHash} AND invite_expires_at > NOW() LIMIT 1`
  );
  const id = rows[0]?.id;
  return id != null ? getAdminById(Number(id)) : null;
}

/** Postavlja lozinku iz pozivnice i poništava token (jednokratan je). */
export async function acceptAdminInvite(adminId: number, passwordHash: string): Promise<void> {
  await ensureInviteColumns();
  await db.execute(sql`
    UPDATE admin_users SET
      password_hash = ${passwordHash},
      invite_token_hash = NULL,
      invite_expires_at = NULL,
      password_set_at = NOW()
    WHERE id = ${adminId}
  `);
}

export type AdminInviteStatus = {
  /** Pozivnica poslana, a lozinka još nije postavljena. */
  pending: boolean;
  /** Link je istekao, a lozinka nije postavljena. */
  expired: boolean;
  sentAt: string | null;
};

/** Status pozivnice po adminu — za oznaku "Čeka prihvaćanje" u popisu. */
export async function getAdminInviteStatuses(): Promise<Map<number, AdminInviteStatus>> {
  await ensureInviteColumns();
  const rows = await db.execute<{
    id: number;
    has_token: boolean;
    expired: boolean;
    sent_at: string | null;
    password_set_at: string | null;
  }>(sql`
    SELECT id,
      invite_token_hash IS NOT NULL AS has_token,
      (invite_expires_at IS NOT NULL AND invite_expires_at <= NOW()) AS expired,
      invite_sent_at::text AS sent_at,
      password_set_at::text AS password_set_at
    FROM admin_users
  `);
  const map = new Map<number, AdminInviteStatus>();
  for (const r of rows) {
    const waiting = Boolean(r.has_token) && !r.password_set_at;
    map.set(Number(r.id), {
      pending: waiting && !r.expired,
      expired: waiting && Boolean(r.expired),
      sentAt: r.sent_at,
    });
  }
  return map;
}

/* ---------------------------------------------------------------- */
/* Uređivanje admina i vlasnika (plan #14)                            */
/* ---------------------------------------------------------------- */

export async function updateAdminAccount(
  id: number,
  data: { role: "admin" | "owner"; displayName: string | null; jobTitle: string | null }
): Promise<void> {
  await db
    .update(adminUsers)
    .set({ role: data.role, displayName: data.displayName, jobTitle: data.jobTitle })
    .where(eq(adminUsers.id, id));
  if (data.role === "admin") {
    // Puni admin vidi sve — stare dodjele samo bi zbunjivale ako ga se
    // kasnije opet prebaci u vlasnika.
    await db.delete(adminAccess).where(eq(adminAccess.adminId, id));
  }
}

/* ---------------------------------------------------------------- */
/* Uplate pretplata (plan #17) i automatski statusi (plan #16)        */
/* ---------------------------------------------------------------- */

let subscriptionPaymentsTablePromise: Promise<void> | null = null;
function ensureSubscriptionPaymentsTable(): Promise<void> {
  if (!subscriptionPaymentsTablePromise) {
    subscriptionPaymentsTablePromise = (async () => {
      await ensureSubscriptionsTableOnce();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS subscription_payments (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER NOT NULL,
          amount_eur INTEGER NOT NULL,
          paid_on TEXT NOT NULL,
          months INTEGER NOT NULL DEFAULT 1,
          method TEXT,
          note TEXT,
          recorded_by TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS subscription_payments_sub_idx ON subscription_payments (subscription_id, paid_on DESC)`
      );
    })().catch((err) => {
      subscriptionPaymentsTablePromise = null;
      throw err;
    });
  }
  return subscriptionPaymentsTablePromise;
}

export type SubscriptionPayment = {
  id: number;
  subscriptionId: number;
  amountEur: number;
  paidOn: string;
  months: number;
  method: string | null;
  note: string | null;
  recordedBy: string | null;
  createdAt: string;
};

type PaymentRow = {
  id: number;
  subscription_id: number;
  amount_eur: number;
  paid_on: string;
  months: number;
  method: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
};

function mapPayment(r: PaymentRow): SubscriptionPayment {
  return {
    id: Number(r.id),
    subscriptionId: Number(r.subscription_id),
    amountEur: Number(r.amount_eur),
    paidOn: r.paid_on,
    months: Number(r.months),
    method: r.method,
    note: r.note,
    recordedBy: r.recorded_by,
    createdAt: r.created_at,
  };
}

/**
 * Evidentira uplatu i produljuje pretplatu za `months` mjeseci (isti izračun
 * kao "Produži" — vidi extendSubscription). Uplata i produljenje idu zajedno
 * da se nikad ne razidu: nema produljenja bez zapisa o novcu.
 */
export async function recordSubscriptionPayment(data: {
  subscriptionId: number;
  amountEur: number;
  paidOn: string;
  months: number;
  method: string | null;
  note: string | null;
  recordedBy: string;
}) {
  await ensureSubscriptionPaymentsTable();
  await db.execute(sql`
    INSERT INTO subscription_payments (subscription_id, amount_eur, paid_on, months, method, note, recorded_by)
    VALUES (${data.subscriptionId}, ${data.amountEur}, ${data.paidOn}, ${data.months}, ${data.method}, ${data.note}, ${data.recordedBy})
  `);
  return extendSubscription(data.subscriptionId, data.months);
}

export async function listPaymentsForSubscription(subscriptionId: number): Promise<SubscriptionPayment[]> {
  await ensureSubscriptionPaymentsTable();
  const rows = await db.execute<PaymentRow>(sql`
    SELECT id, subscription_id, amount_eur, paid_on, months, method, note, recorded_by, created_at::text AS created_at
    FROM subscription_payments WHERE subscription_id = ${subscriptionId}
    ORDER BY paid_on DESC, id DESC
  `);
  return [...rows].map(mapPayment);
}

export async function deleteSubscriptionPayment(id: number): Promise<number | null> {
  await ensureSubscriptionPaymentsTable();
  const rows = await db.execute<{ subscription_id: number }>(
    sql`DELETE FROM subscription_payments WHERE id = ${id} RETURNING subscription_id`
  );
  return rows[0] ? Number(rows[0].subscription_id) : null;
}

/** Zadnja uplata po pretplati (za tablicu i zdravlje klijenta). */
export async function getLastPaymentBySubscription(): Promise<Map<number, string>> {
  await ensureSubscriptionPaymentsTable();
  const rows = await db.execute<{ subscription_id: number; last_paid: string }>(sql`
    SELECT subscription_id, MAX(paid_on) AS last_paid FROM subscription_payments GROUP BY subscription_id
  `);
  return new Map([...rows].map((r) => [Number(r.subscription_id), r.last_paid]));
}

/** Uplaćeno po mjesecu za `year` (12 brojeva) — stvarno primljen novac. */
export async function getPaymentsYearlyByMonth(year: number): Promise<number[]> {
  await ensureSubscriptionPaymentsTable();
  const rows = await db.execute<{ m: string; total: string | number }>(sql`
    SELECT substring(paid_on, 6, 2) AS m, SUM(amount_eur) AS total
    FROM subscription_payments WHERE paid_on LIKE ${`${year}-%`}
    GROUP BY 1
  `);
  const out = new Array(12).fill(0);
  for (const r of rows) {
    const i = Number(r.m) - 1;
    if (i >= 0 && i < 12) out[i] = Number(r.total) || 0;
  }
  return out;
}

/**
 * Automatski statusi (plan #16) — poziva se iz dnevnog crona. Probni period
 * koji je završio prelazi u "active" (klijent sad plaća), a sljedeća naplata
 * je dan kad je probni završio. Ništa se ne otkazuje automatski: pretplata
 * koja kasni samo se tako prikazuje (vidi lib/subscriptionState.ts) da
 * odluku o pauzi donese čovjek.
 */
export async function autoUpdateSubscriptionStatuses(): Promise<{ trialsEnded: number }> {
  await ensureSubscriptionsTableOnce();
  const today = todayDateStringZagreb();
  const rows = await db.execute<{ id: number }>(sql`
    UPDATE subscriptions SET
      status = 'active',
      is_trial = false,
      next_renewal_date = CASE WHEN trial_ends_at IS NOT NULL AND trial_ends_at > next_renewal_date
        THEN trial_ends_at ELSE next_renewal_date END,
      updated_at = NOW()
    WHERE (status = 'trial' OR is_trial = true)
      AND trial_ends_at IS NOT NULL AND trial_ends_at <= ${today}
      AND status NOT IN ('cancelled', 'paused')
    RETURNING id
  `);
  return { trialsEnded: [...rows].length };
}

/* ---------------------------------------------------------------- */
/* Zdravlje klijenta (plan #19)                                       */
/* ---------------------------------------------------------------- */

export type ClientHealth = {
  source: "property" | "company";
  sourceId: number;
  name: string;
  slug: string;
  published: boolean;
  monthlyPriceEur: number | null;
  subscriptionId: number | null;
  subscriptionStatus: string | null;
  nextRenewalDate: string | null;
  views30d: number;
  inquiries60d: number;
  lastInquiryAt: string | null;
  ownerCount: number;
  ownerLastSeen: string | null;
};

/** Sirovi signali po klijentu (vikendica/firma); ocjenu računa
    lib/clientHealth.ts da se pravila mogu mijenjati bez diranja SQL-a. */
export async function getClientHealthSignals(): Promise<ClientHealth[]> {
  await ensureSubscriptionsTableOnce();
  const since30 = dateStringOffsetFromTodayZagreb(-30);
  const [props, comps, subs, views, inqs, owners] = await Promise.all([
    listProperties(),
    listCompanies(),
    db.select().from(subscriptions),
    db.execute<{ source: string; source_id: number; n: string | number }>(
      sql`SELECT source, source_id, COUNT(*) AS n FROM page_views WHERE date >= ${since30} GROUP BY source, source_id`
    ),
    db.execute<{ source: string; source_id: number; n: string | number; last_at: string | null }>(sql`
      SELECT source, source_id,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days') AS n,
        MAX(created_at)::text AS last_at
      FROM inquiries WHERE source_id IS NOT NULL GROUP BY source, source_id
    `).catch(() => [] as { source: string; source_id: number; n: string | number; last_at: string | null }[]),
    db.execute<{ property_id: number | null; company_id: number | null; n: string | number; last_seen: string | null }>(sql`
      SELECT a.property_id, a.company_id, COUNT(*) AS n, MAX(u.last_login_date) AS last_seen
      FROM admin_access a JOIN admin_users u ON u.id = a.admin_id
      GROUP BY a.property_id, a.company_id
    `),
  ]);
  const key = (s: string, id: number) => `${s}:${id}`;
  const viewMap = new Map([...views].map((v) => [key(v.source, Number(v.source_id)), Number(v.n)]));
  const inqMap = new Map([...inqs].map((v) => [key(v.source, Number(v.source_id)), v]));
  const ownerMap = new Map<string, { n: number; lastSeen: string | null }>();
  for (const o of owners) {
    const k = o.property_id != null ? key("property", Number(o.property_id)) : key("company", Number(o.company_id));
    ownerMap.set(k, { n: Number(o.n), lastSeen: o.last_seen });
  }
  // Najnovija ne-otkazana pretplata po klijentu (ili bilo koja ako su sve otkazane).
  const subMap = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    const k = key(s.source, s.sourceId);
    const prev = subMap.get(k);
    const rank = (x: (typeof subs)[number]) => (x.status === "cancelled" ? 0 : 1);
    if (!prev || rank(s) > rank(prev) || (rank(s) === rank(prev) && s.id > prev.id)) subMap.set(k, s);
  }
  const build = (
    source: "property" | "company",
    c: { id: number; name: string; slug: string; published: boolean }
  ): ClientHealth => {
    const k = key(source, c.id);
    const sub = subMap.get(k);
    const inq = inqMap.get(k);
    const own = ownerMap.get(k);
    return {
      source,
      sourceId: c.id,
      name: c.name,
      slug: c.slug,
      published: c.published,
      monthlyPriceEur: sub?.monthlyPriceEur ?? null,
      subscriptionId: sub?.id ?? null,
      subscriptionStatus: sub?.status ?? null,
      nextRenewalDate: sub?.nextRenewalDate ?? null,
      views30d: viewMap.get(k) ?? 0,
      inquiries60d: inq ? Number(inq.n) : 0,
      lastInquiryAt: inq?.last_at ?? null,
      ownerCount: own?.n ?? 0,
      ownerLastSeen: own?.lastSeen ?? null,
    };
  };
  return [...props.map((p) => build("property", p)), ...comps.map((c) => build("company", c))];
}

/* ---------------------------------------------------------------- */
/* Superadmin "Danas" (plan #27)                                      */
/* ---------------------------------------------------------------- */

export type SuperadminToday = {
  arrivals: { guestName: string; propertyName: string; propertyId: number }[];
  departures: { guestName: string; propertyName: string; propertyId: number }[];
  unansweredInquiries: number;
  oldestUnansweredHours: number | null;
  myTasksDue: { id: number; title: string; dueDate: string | null }[];
};

export async function getSuperadminToday(email: string): Promise<SuperadminToday> {
  const today = todayDateStringZagreb();
  const props = await listProperties();
  const nameById = new Map(props.map((p) => [p.id, p.name]));
  const [arr, dep, unanswered, tasks] = await Promise.all([
    db.select().from(reservations).where(eq(reservations.checkIn, today)),
    db.select().from(reservations).where(eq(reservations.checkOut, today)),
    db
      .execute<{ n: string | number; oldest_h: string | number | null }>(sql`
        SELECT COUNT(*) AS n, EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 3600 AS oldest_h
        FROM inquiries WHERE replied = false
      `)
      .catch(() => [{ n: 0, oldest_h: null }]),
    (async (): Promise<{ id: number; title: string; due_date: string | null }[]> => {
      if (!(await tableExists("team_tasks"))) return [];
      const r = await db.execute<{ id: number; title: string; due_date: string | null }>(sql`
        SELECT id, title, due_date FROM team_tasks
        WHERE assigned_to_email = ${email} AND status <> 'done'
          AND due_date IS NOT NULL AND due_date <> '' AND due_date <= ${today}
        ORDER BY due_date ASC LIMIT 8
      `);
      return [...r];
    })(),
  ]);
  const toRow = (r: (typeof arr)[number]) => ({
    guestName: r.guestName,
    propertyName: nameById.get(r.propertyId) ?? "Vikendica",
    propertyId: r.propertyId,
  });
  const u = [...unanswered][0];
  return {
    arrivals: arr.map(toRow),
    departures: dep.map(toRow),
    unansweredInquiries: Number(u?.n ?? 0),
    oldestUnansweredHours: u?.oldest_h == null ? null : Math.round(Number(u.oldest_h)),
    myTasksDue: [...tasks].map((t) => ({ id: Number(t.id), title: t.title, dueDate: t.due_date })),
  };
}

/* ---------------------------------------------------------------- */
/* Paginacija i filtri (plan #24)                                     */
/* ---------------------------------------------------------------- */

export async function listActivityPage(opts: {
  propertyId?: number | null;
  action?: string | null;
  q?: string | null;
  page: number;
  pageSize: number;
}) {
  const conds = [];
  if (opts.propertyId) conds.push(eq(activityLog.propertyId, opts.propertyId));
  if (opts.action) conds.push(eq(activityLog.action, opts.action));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(sql`(${activityLog.targetLabel} ILIKE ${like} OR ${activityLog.adminEmail} ILIKE ${like})`);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, total] = await Promise.all([
    db
      .select()
      .from(activityLog)
      .where(where)
      .orderBy(desc(activityLog.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(activityLog).where(where),
  ]);
  return { rows, total: Number(total[0]?.n ?? 0) };
}

/* ---------------------------------------------------------------- */
/* Paleta naredbi Cmd+K (plan #22) — sve što se može otvoriti, u      */
/* jednom malom popisu (imena i linkovi, bez osjetljivih podataka).   */
/* ---------------------------------------------------------------- */

export async function getCommandPaletteItems() {
  const [props, comps] = await Promise.all([listProperties(), listCompanies()]);
  return {
    properties: props.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
    companies: comps.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  };
}

/* ---------------------------------------------------------------- */
/* Proizvodi — statistika za oglase (pregledi /proizvodi/<slug> i   */
/* upiti s te stranice), prikazuje se u /admin/products/[id].        */
/* ---------------------------------------------------------------- */

export async function getProductPromoStats(productId: number, sinceDate: string) {
  const [views, inq] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${pageViews.date} >= ${sinceDate})::int`,
      })
      .from(pageViews)
      .where(and(eq(pageViews.source, "product"), eq(pageViews.sourceId, productId))),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${inquiries.createdAt} >= ${sinceDate}::date)::int`,
      })
      .from(inquiries)
      .where(and(eq(inquiries.source, "product"), eq(inquiries.sourceId, productId)))
      .catch(() => [{ total: 0, recent: 0 }]),
  ]);
  return {
    viewsTotal: Number(views[0]?.total ?? 0),
    views30d: Number(views[0]?.recent ?? 0),
    inquiriesTotal: Number(inq[0]?.total ?? 0),
    inquiries30d: Number(inq[0]?.recent ?? 0),
  };
}
