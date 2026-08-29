import { eq, desc, asc } from "drizzle-orm";
import { db } from "./index";
import {
  agency,
  properties,
  studies,
  products,
  adminUsers,
  type NewProperty,
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

export async function deleteAdmin(id: number) {
await db.delete(adminUsers).where(eq(adminUsers.id, id));
}

export async function countAdmins() {
const rows = await db.select().from(adminUsers);
return rows.length;
}
