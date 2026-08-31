import { eq, desc, asc } from "drizzle-orm";
import { db } from "./index";
import {
  agency,
  properties,
  companies,
  studies,
  products,
  adminUsers,
  type NewProperty,
  type NewCompany,
  type NewStudy,
  type NewProduct,
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
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "42P01");
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

export async function createAdmin(data: { email: string; passwordHash: string; isSuperAdmin?: boolean }) {
const [row] = await db
.insert(adminUsers)
.values({ email: data.email, passwordHash: data.passwordHash, isSuperAdmin: data.isSuperAdmin ?? false })
.returning();
return row;
}

export async function updateAdminPassword(id: number, passwordHash: string) {
await db.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, id));
}

export async function deleteAdmin(id: number) {
await db.delete(adminUsers).where(eq(adminUsers.id, id));
}

export async function countAdmins() {
const rows = await db.select().from(adminUsers);
return rows.length;
}
