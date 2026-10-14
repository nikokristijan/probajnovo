import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { nfcLinks, type NewNfcLink } from "./schema";

/* ---------------------------------------------------------------- */
/* Dinamički NFC linkovi (/admin/linkovi, app/k/[code]/route.ts) —   */
/* vidi komentar uz nfcLinks u schema.ts. Tablica se sama kreira     */
/* pri prvom upitu, isti obrazac kao ensureNfcTagsTable.             */
/* ---------------------------------------------------------------- */

let tablePromise: Promise<void> | null = null;
function ensureNfcLinksTableOnce(): Promise<void> {
  if (!tablePromise) {
    tablePromise = db
      .execute(
        sql`
        CREATE TABLE IF NOT EXISTS nfc_links (
          id SERIAL PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          target_url TEXT NOT NULL,
          previous_url TEXT,
          active BOOLEAN NOT NULL DEFAULT true,
          scan_count INTEGER NOT NULL DEFAULT 0,
          last_scan_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `
      )
      .then(() => undefined)
      .catch((err) => {
        tablePromise = null;
        throw err;
      });
  }
  return tablePromise;
}

export async function listNfcLinks() {
  await ensureNfcLinksTableOnce();
  return db.select().from(nfcLinks).orderBy(desc(nfcLinks.createdAt));
}

export async function getNfcLinkById(id: number) {
  await ensureNfcLinksTableOnce();
  const rows = await db.select().from(nfcLinks).where(eq(nfcLinks.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Za javno preusmjeravanje — samo ono što treba (odredište + je li aktivan). */
export async function getNfcLinkTarget(code: string) {
  await ensureNfcLinksTableOnce();
  const rows = await db
    .select({ id: nfcLinks.id, targetUrl: nfcLinks.targetUrl, active: nfcLinks.active })
    .from(nfcLinks)
    .where(eq(nfcLinks.code, code))
    .limit(1);
  return rows[0] ?? null;
}

export async function isNfcLinkCodeTaken(code: string) {
  await ensureNfcLinksTableOnce();
  const rows = await db.select({ id: nfcLinks.id }).from(nfcLinks).where(eq(nfcLinks.code, code)).limit(1);
  return rows.length > 0;
}

export async function createNfcLink(data: NewNfcLink) {
  await ensureNfcLinksTableOnce();
  const [row] = await db.insert(nfcLinks).values(data).returning();
  return row;
}

export async function updateNfcLink(id: number, data: Partial<NewNfcLink>) {
  await ensureNfcLinksTableOnce();
  const [row] = await db
    .update(nfcLinks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(nfcLinks.id, id))
    .returning();
  return row;
}

/** Brojač otvaranja — poziva se NAKON slanja preusmjeravanja (after()), da ne usporava. */
export async function recordNfcLinkScan(id: number) {
  await db
    .update(nfcLinks)
    .set({ scanCount: sql`${nfcLinks.scanCount} + 1`, lastScanAt: new Date() })
    .where(eq(nfcLinks.id, id));
}
