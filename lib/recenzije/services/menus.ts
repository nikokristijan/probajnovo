import "server-only";
import { and, asc, count, eq, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import {
  menuCategories,
  menuItems,
  menus,
  organizations,
  type Menu,
  type MenuCategory,
  type MenuItem,
} from "@/lib/recenzije/db/schema";
import { env } from "@/lib/recenzije/env";
import { createId } from "@/lib/recenzije/id";
import { MENU_DELAY_MAX, MENU_DELAY_MIN } from "@/lib/recenzije/guest-consent";
import { MAX_PRICE_CENTS } from "@/lib/recenzije/menu-format";
import { displayMenuTitle, parseMenuKind, type MenuKind } from "@/lib/recenzije/menu-noun";
import { IMPORT_LIMITS, parseMenuText, type ParsedMenu } from "@/lib/recenzije/menu-import";
import { suggestMenuSlug, validateMenuSlug } from "@/lib/recenzije/menu-slug";

/**
 * Digitalni jelovnik ugostiteljske tvrtke (organizations.is_venue): postavke, kategorije, stavke, brzi uvoz iz teksta
 * i javno čitanje po adresi. Sve što piše ili čita u ime operatera uzima `organizationId` i u SVAKOM upitu ga uvjetuje
 * (tablice nose organization_id), pa tvrtka A ne može dohvatiti ni promijeniti tuđe stavke ni kad zna njihov id.
 * Javno čitanje (getPublicMenu*) ide samo po adresi i vraća samo javna polja: nikad id tvrtke, brojeve ni goste.
 *
 * Greške validacije se vraćaju kao { ok: false, error, field? } (hrvatski tekst, spreman za prikaz), a ne bacaju.
 */

export const MENU_LIMITS = {
  maxCategories: IMPORT_LIMITS.maxCategories,
  maxItems: IMPORT_LIMITS.maxItems,
  title: 80,
  intro: 600,
  name: IMPORT_LIMITS.nameChars,
  description: IMPORT_LIMITS.descriptionChars,
  allergens: 200,
  url: 500,
  logoUrl: 1000,
  importChars: IMPORT_LIMITS.maxChars,
} as const;

export type MenuResult<T> = { ok: true; value: T } | { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): { ok: false; error: string; field?: string } => ({ ok: false, error, field });
const ok = <T>(value: T): MenuResult<T> => ({ ok: true, value });

const NOT_VENUE = "Jelovnik je dostupan samo za ugostiteljstvo.";
const DEMO_LOCKED = "Ovo je primjer za razgledavanje, izmjene su isključene.";

// --- Validacija (zod) ---

const oneLine = (label: string, maxChars: number) =>
  z
    .string({ error: `${label}: neispravan unos` })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(maxChars, `${label}: najviše ${maxChars} znakova`));
const requiredLine = (label: string, maxChars: number) => oneLine(label, maxChars).pipe(z.string().min(1, `${label}: obavezno polje`));
/** Prazan tekst znači "obriši" (null); undefined znači "ne diraj". */
const optionalLine = (label: string, maxChars: number) => oneLine(label, maxChars).nullish();

/** https adresa (bez korisničkog imena i lozinke, s točkom u nazivu domene). Bez sheme se dodaje https://. */
const httpsUrlOf = (label: string, maxChars: number, example: string) =>
  z
    .string({ error: `${label}: neispravan unos` })
    .transform((s) => {
      const v = s.trim();
      return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? `https://${v}` : v;
    })
    .pipe(
      z
        .string()
        .max(maxChars, `${label}: najviše ${maxChars} znakova`)
        .refine((v) => {
          try {
            const u = new URL(v);
            return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".");
          } catch {
            return false;
          }
        }, `${label} mora biti ispravna https adresa (npr. ${example}).`)
    );

const httpsUrl = httpsUrlOf("Adresa jelovnika", MENU_LIMITS.url, "https://www.konoba.hr/jelovnik.pdf");
const logoHttpsUrl = httpsUrlOf("Adresa logotipa", MENU_LIMITS.logoUrl, "https://www.konoba.hr/logo.png");

const settingsSchema = z.object({
  slug: z.string({ error: "Adresa: neispravan unos" }).optional(),
  title: requiredLine("Naslov", MENU_LIMITS.title).optional(),
  intro: optionalLine("Uvod", MENU_LIMITS.intro),
  introEn: optionalLine("Uvod (engleski)", MENU_LIMITS.intro),
  externalUrl: z.union([z.null(), z.literal(""), httpsUrl]).optional(),
  /** Logo lokala: https adresa slike; prazno/null = ukloni. */
  logoUrl: z.union([z.null(), z.literal(""), logoHttpsUrl]).optional(),
  allowSkip: z.boolean().optional(),
  menuKind: z.enum(["jelovnik", "meni"], { error: "Naziv na stranici mora biti Jelovnik ili Meni." }).optional(),
  noticesEnabled: z.boolean({ error: "Neispravan unos." }).optional(),
  delayMinutes: z
    .number({ error: `Odgoda mora biti između ${MENU_DELAY_MIN} i ${MENU_DELAY_MAX} minuta.` })
    .int(`Odgoda mora biti cijeli broj minuta.`)
    .min(MENU_DELAY_MIN, `Odgoda mora biti između ${MENU_DELAY_MIN} i ${MENU_DELAY_MAX} minuta.`)
    .max(MENU_DELAY_MAX, `Odgoda mora biti između ${MENU_DELAY_MIN} i ${MENU_DELAY_MAX} minuta.`)
    .optional(),
  enabled: z.boolean().optional(),
});

const categorySchema = z.object({
  name: requiredLine("Naziv kategorije", MENU_LIMITS.name),
  nameEn: optionalLine("Naziv kategorije (engleski)", MENU_LIMITS.name),
});

const priceSchema = z
  .number({ error: "Cijena: neispravan unos" })
  .int("Cijena mora biti u centima (cijeli broj).")
  .min(0, "Cijena ne može biti negativna.")
  .max(MAX_PRICE_CENTS, "Cijena je prevelika.");

const itemSchema = z.object({
  name: requiredLine("Naziv", MENU_LIMITS.name),
  nameEn: optionalLine("Naziv (engleski)", MENU_LIMITS.name),
  description: optionalLine("Opis", MENU_LIMITS.description),
  descriptionEn: optionalLine("Opis (engleski)", MENU_LIMITS.description),
  priceCents: priceSchema,
  allergens: optionalLine("Alergeni", MENU_LIMITS.allergens),
  available: z.boolean().optional(),
});

function zodFail(err: z.ZodError) {
  const issue = err.issues[0];
  return fail(issue?.message ?? "Neispravan unos.", typeof issue?.path[0] === "string" ? issue.path[0] : undefined);
}

const orNull = (v: string | null | undefined) => (v ? v : null);

function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

// --- Jelovnik tvrtke ---

/** Javna adresa jelovnika (za QR kod i poveznice). `table` je neobavezan broj stola (?stol=), samo informativno. */
export function menuPublicUrl(slug: string, table?: string | number | null): string {
  const base = `${env.appUrl}/jelovnik/${slug}`;
  const t = table === null || table === undefined ? "" : String(table).trim();
  return t ? `${base}?stol=${encodeURIComponent(t.slice(0, 20))}` : base;
}

type VenueOrg = { id: string; name: string; isVenue: boolean; isDemo: boolean };

async function loadOrg(organizationId: string): Promise<VenueOrg | null> {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, isVenue: organizations.isVenue, isDemo: organizations.isDemo })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org ?? null;
}

async function loadMenu(organizationId: string): Promise<Menu | null> {
  const [menu] = await db.select().from(menus).where(eq(menus.organizationId, organizationId)).limit(1);
  return menu ?? null;
}

async function slugTaken(slug: string, exceptOrganizationId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: menus.id })
    .from(menus)
    .where(and(eq(menus.slug, slug), exceptOrganizationId ? ne(menus.organizationId, exceptOrganizationId) : undefined))
    .limit(1);
  return Boolean(row);
}

/** Je li adresa slobodna i ispravna (za provjeru u obrascu prije spremanja). */
export async function checkMenuSlug(slug: string, organizationId?: string): Promise<MenuResult<string>> {
  await ensureReviewsDb();
  const v = validateMenuSlug(slug);
  if (!v.ok) return fail(v.error, "slug");
  if (await slugTaken(v.slug, organizationId)) return fail("Ta je adresa već zauzeta. Odaberite drugu.", "slug");
  return ok(v.slug);
}

/**
 * Jelovnik tvrtke; ako ga nema, nastaje s adresom iz naziva tvrtke (jedinstvenom). Samo za ugostiteljske tvrtke:
 * za ostale vraća null. Idempotentno i sigurno kod istodobnih poziva.
 */
async function ensureMenu(organizationId: string): Promise<{ menu: Menu; org: VenueOrg } | null> {
  await ensureReviewsDb();
  const org = await loadOrg(organizationId);
  if (!org || !org.isVenue) return null;
  const existing = await loadMenu(organizationId);
  if (existing) return { menu: existing, org };

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = attempt < 6 ? suggestMenuSlug(org.name, attempt) : `${suggestMenuSlug(org.name, 0).slice(0, 30)}-${createId().slice(-6)}`;
    if (await slugTaken(slug)) continue;
    // Pregled bez broja je zadano uključen (sitna poveznica ispod vrata); operater ga može isključiti u postavkama.
    await db.insert(menus).values({ organizationId, slug, allowSkip: true }).onConflictDoNothing();
    const created = await loadMenu(organizationId);
    if (created) return { menu: created, org };
  }
  throw new Error("Jelovnik nije napravljen: nije pronađena slobodna adresa.");
}

/** Jelovnik ugostiteljske tvrtke (stvara ga ako ga nema); za tvrtku koja nije ugostiteljska vraća null. */
export async function ensureVenueMenu(organizationId: string): Promise<Menu | null> {
  const m = await ensureMenu(organizationId);
  return m ? m.menu : null;
}

/** Za izmjene: kao ensureMenu, ali demo radni prostor je samo za čitanje (isto kao updateClientDetails). */
async function writableMenu(organizationId: string): Promise<MenuResult<{ menu: Menu; org: VenueOrg }>> {
  const m = await ensureMenu(organizationId);
  if (!m) return fail(NOT_VENUE);
  if (m.org.isDemo) return fail(DEMO_LOCKED);
  return ok(m);
}

export type OperatorCategory = MenuCategory & { items: MenuItem[] };
export type OperatorMenu = {
  menu: Menu;
  venueName: string;
  /** Apsolutna javna adresa jelovnika (za QR kod). */
  publicUrl: string;
  categories: OperatorCategory[];
  counts: { categories: number; items: number };
};

/**
 * Cijeli jelovnik za uređivanje, s kategorijama i stavkama po redoslijedu. Za ugostiteljsku tvrtku bez jelovnika
 * on se ovdje stvara (zadana adresa iz naziva). Za tvrtku koja nije ugostiteljska (ili ne postoji) vraća null.
 */
export async function getVenueMenuForOperator(organizationId: string): Promise<OperatorMenu | null> {
  const m = await ensureMenu(organizationId);
  if (!m) return null;
  const [cats, items] = await Promise.all([
    db
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.menuId, m.menu.id), eq(menuCategories.organizationId, organizationId)))
      .orderBy(asc(menuCategories.position), asc(menuCategories.createdAt)),
    db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.menuId, m.menu.id), eq(menuItems.organizationId, organizationId)))
      .orderBy(asc(menuItems.position), asc(menuItems.createdAt)),
  ]);
  const byCat = new Map<string, MenuItem[]>();
  for (const it of items) {
    const list = byCat.get(it.categoryId);
    if (list) list.push(it);
    else byCat.set(it.categoryId, [it]);
  }
  return {
    menu: m.menu,
    venueName: m.org.name,
    publicUrl: menuPublicUrl(m.menu.slug),
    categories: cats.map((c) => ({ ...c, items: byCat.get(c.id) ?? [] })),
    counts: { categories: cats.length, items: items.length },
  };
}

export type MenuSettingsInput = {
  slug?: string;
  title?: string;
  intro?: string | null;
  introEn?: string | null;
  /** Vlastiti jelovnik lokala (https). Prazno/null = koristi naš prikaz. */
  externalUrl?: string | null;
  /** Logo lokala (https adresa slike). Prazno/null = ukloni. */
  logoUrl?: string | null;
  allowSkip?: boolean;
  /** Kako se stranica zove gostu: "jelovnik" ili "meni". */
  menuKind?: MenuKind;
  /** Lokal šalje i povremene obavijesti (mijenja tekst privole koji gost vidi). */
  noticesEnabled?: boolean;
  /** 60 do 240 minuta. */
  delayMinutes?: number;
  enabled?: boolean;
};

/**
 * Sprema postavke jelovnika (samo polja koja su poslana). Promjena adrese (slug) prekida već ispisane QR kodove sa
 * starom adresom, pa sučelje treba upozoriti prije toga.
 */
export async function upsertMenuSettings(organizationId: string, input: MenuSettingsInput): Promise<MenuResult<Menu>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  // Razmaci umjesto adrese znače "obriši", kao i prazan tekst.
  const blank = (v: unknown) => typeof v === "string" && !v.trim();
  const raw = { ...input, ...(blank(input.externalUrl) ? { externalUrl: "" } : {}), ...(blank(input.logoUrl) ? { logoUrl: "" } : {}) };
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const patch: Partial<typeof menus.$inferInsert> = {};
  if (d.slug !== undefined && d.slug.trim() !== m.menu.slug) {
    const v = validateMenuSlug(d.slug);
    if (!v.ok) return fail(v.error, "slug");
    if (await slugTaken(v.slug, organizationId)) return fail("Ta je adresa već zauzeta. Odaberite drugu.", "slug");
    patch.slug = v.slug;
  }
  if (d.title !== undefined) patch.title = d.title;
  if (d.intro !== undefined) patch.intro = orNull(d.intro);
  if (d.introEn !== undefined) patch.introEn = orNull(d.introEn);
  if (d.externalUrl !== undefined) patch.externalUrl = orNull(d.externalUrl);
  if (d.logoUrl !== undefined) patch.logoUrl = orNull(d.logoUrl);
  if (d.allowSkip !== undefined) patch.allowSkip = d.allowSkip;
  if (d.menuKind !== undefined) patch.menuKind = d.menuKind;
  if (d.noticesEnabled !== undefined) patch.noticesEnabled = d.noticesEnabled;
  if (d.delayMinutes !== undefined) patch.delayMinutes = d.delayMinutes;
  if (d.enabled !== undefined) patch.enabled = d.enabled;
  if (Object.keys(patch).length === 0) return ok(m.menu);

  try {
    const [updated] = await db
      .update(menus)
      .set(patch)
      .where(and(eq(menus.id, m.menu.id), eq(menus.organizationId, organizationId)))
      .returning();
    return ok(updated);
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Ta je adresa već zauzeta. Odaberite drugu.", "slug");
    throw e;
  }
}

// --- Kategorije ---

export type CategoryInput = { name: string; nameEn?: string | null };

async function nextPosition(table: "category" | "item", scopeId: string): Promise<number> {
  const [row] =
    table === "category"
      ? await db.select({ v: max(menuCategories.position) }).from(menuCategories).where(eq(menuCategories.menuId, scopeId))
      : await db.select({ v: max(menuItems.position) }).from(menuItems).where(eq(menuItems.categoryId, scopeId));
  return (row?.v ?? -1) + 1;
}

export async function createCategory(organizationId: string, input: CategoryInput): Promise<MenuResult<MenuCategory>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const [{ n }] = await db.select({ n: count() }).from(menuCategories).where(eq(menuCategories.menuId, m.menu.id));
  if (n >= MENU_LIMITS.maxCategories) return fail(`Najviše ${MENU_LIMITS.maxCategories} kategorija po jelovniku.`);
  const [row] = await db
    .insert(menuCategories)
    .values({
      menuId: m.menu.id,
      organizationId,
      name: parsed.data.name,
      nameEn: orNull(parsed.data.nameEn),
      position: await nextPosition("category", m.menu.id),
    })
    .returning();
  return ok(row);
}

export async function updateCategory(organizationId: string, categoryId: string, patch: Partial<CategoryInput>): Promise<MenuResult<MenuCategory>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const parsed = categorySchema.partial().safeParse(patch);
  if (!parsed.success) return zodFail(parsed.error);
  const set: Partial<typeof menuCategories.$inferInsert> = {};
  if (parsed.data.name !== undefined) set.name = parsed.data.name;
  if (parsed.data.nameEn !== undefined) set.nameEn = orNull(parsed.data.nameEn);
  const where = and(eq(menuCategories.id, categoryId), eq(menuCategories.organizationId, organizationId), eq(menuCategories.menuId, m.menu.id));
  if (Object.keys(set).length === 0) {
    const [row] = await db.select().from(menuCategories).where(where).limit(1);
    return row ? ok(row) : fail("Kategorija nije pronađena.");
  }
  const [row] = await db.update(menuCategories).set(set).where(where).returning();
  return row ? ok(row) : fail("Kategorija nije pronađena.");
}

/** Briše kategoriju i sve njezine stavke. Vraća koliko je stavki obrisano. */
export async function deleteCategory(organizationId: string, categoryId: string): Promise<MenuResult<{ deletedItems: number }>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  return db.transaction(async (tx) => {
    const [cat] = await tx
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.organizationId, organizationId), eq(menuCategories.menuId, m.menu.id)))
      .limit(1);
    if (!cat) return fail("Kategorija nije pronađena.");
    const [{ n }] = await tx
      .select({ n: count() })
      .from(menuItems)
      .where(and(eq(menuItems.categoryId, categoryId), eq(menuItems.organizationId, organizationId)));
    await tx.delete(menuCategories).where(and(eq(menuCategories.id, categoryId), eq(menuCategories.organizationId, organizationId)));
    return ok({ deletedItems: n });
  });
}

/** Postavlja redoslijed kategorija; id-evi koji nisu navedeni idu na kraj, a tuđi ili nepostojeći se ignoriraju. */
export async function reorderCategories(organizationId: string, orderedIds: string[]): Promise<MenuResult<{ count: number }>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const existing = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(and(eq(menuCategories.menuId, m.menu.id), eq(menuCategories.organizationId, organizationId)))
    .orderBy(asc(menuCategories.position), asc(menuCategories.createdAt));
  const order = mergeOrder(
    existing.map((r) => r.id),
    orderedIds
  );
  await writePositions("nr_menu_categories", organizationId, "menu_id", m.menu.id, order);
  return ok({ count: order.length });
}

/** Pomiče kategoriju za jedno mjesto gore ili dolje. */
export async function moveCategory(organizationId: string, categoryId: string, direction: "up" | "down"): Promise<MenuResult<{ moved: boolean }>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const rows = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(and(eq(menuCategories.menuId, m.menu.id), eq(menuCategories.organizationId, organizationId)))
    .orderBy(asc(menuCategories.position), asc(menuCategories.createdAt));
  const ids = rows.map((r) => r.id);
  const moved = swapInOrder(ids, categoryId, direction);
  if (moved === null) return fail("Kategorija nije pronađena.");
  if (moved) await writePositions("nr_menu_categories", organizationId, "menu_id", m.menu.id, ids);
  return ok({ moved });
}

// --- Stavke ---

export type ItemInput = {
  name: string;
  nameEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  /** Cijena u centima (EUR); iz teksta "5,50" pretvara parsePriceToCents (lib/recenzije/menu-format). */
  priceCents: number;
  allergens?: string | null;
  available?: boolean;
};
export type ItemPatch = Partial<ItemInput> & { categoryId?: string };

async function ownedCategory(organizationId: string, menuId: string, categoryId: string) {
  const [cat] = await db
    .select()
    .from(menuCategories)
    .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.organizationId, organizationId), eq(menuCategories.menuId, menuId)))
    .limit(1);
  return cat ?? null;
}

export async function createItem(organizationId: string, categoryId: string, input: ItemInput): Promise<MenuResult<MenuItem>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const cat = await ownedCategory(organizationId, m.menu.id, categoryId);
  if (!cat) return fail("Kategorija nije pronađena.");
  const [{ n }] = await db.select({ n: count() }).from(menuItems).where(eq(menuItems.menuId, m.menu.id));
  if (n >= MENU_LIMITS.maxItems) return fail(`Najviše ${MENU_LIMITS.maxItems} stavki po jelovniku.`);
  const d = parsed.data;
  const [row] = await db
    .insert(menuItems)
    .values({
      menuId: m.menu.id,
      categoryId: cat.id,
      organizationId,
      name: d.name,
      nameEn: orNull(d.nameEn),
      description: orNull(d.description),
      descriptionEn: orNull(d.descriptionEn),
      priceCents: d.priceCents,
      allergens: orNull(d.allergens),
      available: d.available ?? true,
      position: await nextPosition("item", cat.id),
    })
    .returning();
  return ok(row);
}

export async function updateItem(organizationId: string, itemId: string, patch: ItemPatch): Promise<MenuResult<MenuItem>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const parsed = itemSchema.partial().safeParse(patch);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  const where = and(eq(menuItems.id, itemId), eq(menuItems.organizationId, organizationId), eq(menuItems.menuId, m.menu.id));
  const [current] = await db.select().from(menuItems).where(where).limit(1);
  if (!current) return fail("Stavka nije pronađena.");

  const set: Partial<typeof menuItems.$inferInsert> = {};
  if (d.name !== undefined) set.name = d.name;
  if (d.nameEn !== undefined) set.nameEn = orNull(d.nameEn);
  if (d.description !== undefined) set.description = orNull(d.description);
  if (d.descriptionEn !== undefined) set.descriptionEn = orNull(d.descriptionEn);
  if (d.priceCents !== undefined) set.priceCents = d.priceCents;
  if (d.allergens !== undefined) set.allergens = orNull(d.allergens);
  if (d.available !== undefined) set.available = d.available;
  if (typeof patch.categoryId === "string" && patch.categoryId !== current.categoryId) {
    const target = await ownedCategory(organizationId, m.menu.id, patch.categoryId);
    if (!target) return fail("Kategorija nije pronađena.", "categoryId");
    set.categoryId = target.id;
    set.position = await nextPosition("item", target.id);
  }
  if (Object.keys(set).length === 0) return ok(current);
  const [row] = await db.update(menuItems).set(set).where(where).returning();
  return row ? ok(row) : fail("Stavka nije pronađena.");
}

export async function deleteItem(organizationId: string, itemId: string): Promise<MenuResult<{ deleted: true }>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const rows = await db
    .delete(menuItems)
    .where(and(eq(menuItems.id, itemId), eq(menuItems.organizationId, organizationId), eq(menuItems.menuId, m.menu.id)))
    .returning({ id: menuItems.id });
  return rows.length ? ok({ deleted: true as const }) : fail("Stavka nije pronađena.");
}

/** Postavlja redoslijed stavki unutar kategorije; neviđene stavke idu na kraj, tuđi id-evi se ignoriraju. */
export async function reorderItems(organizationId: string, categoryId: string, orderedIds: string[]): Promise<MenuResult<{ count: number }>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const cat = await ownedCategory(organizationId, m.menu.id, categoryId);
  if (!cat) return fail("Kategorija nije pronađena.");
  const existing = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.categoryId, cat.id), eq(menuItems.organizationId, organizationId)))
    .orderBy(asc(menuItems.position), asc(menuItems.createdAt));
  const order = mergeOrder(
    existing.map((r) => r.id),
    orderedIds
  );
  await writePositions("nr_menu_items", organizationId, "category_id", cat.id, order);
  return ok({ count: order.length });
}

/** Pomiče stavku za jedno mjesto gore ili dolje unutar njezine kategorije. */
export async function moveItem(organizationId: string, itemId: string, direction: "up" | "down"): Promise<MenuResult<{ moved: boolean }>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const [item] = await db
    .select({ categoryId: menuItems.categoryId })
    .from(menuItems)
    .where(and(eq(menuItems.id, itemId), eq(menuItems.organizationId, organizationId), eq(menuItems.menuId, m.menu.id)))
    .limit(1);
  if (!item) return fail("Stavka nije pronađena.");
  const rows = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.categoryId, item.categoryId), eq(menuItems.organizationId, organizationId)))
    .orderBy(asc(menuItems.position), asc(menuItems.createdAt));
  const ids = rows.map((r) => r.id);
  const moved = swapInOrder(ids, itemId, direction);
  if (moved === null) return fail("Stavka nije pronađena.");
  if (moved) await writePositions("nr_menu_items", organizationId, "category_id", item.categoryId, ids);
  return ok({ moved });
}

/** Ponovljene stavke odbacuje, tuđe (koje ne postoje u `existing`) ignorira, a ostale dodaje na kraj u dosadašnjem redu. */
export function mergeOrder(existing: string[], requested: string[]): string[] {
  const known = new Set(existing);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of requested) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of existing) if (!seen.has(id)) out.push(id);
  return out;
}

/** Zamjenjuje mjesto s prvim susjedom. null = id ne postoji, false = već je na rubu, true = pomaknuto (niz je izmijenjen). */
export function swapInOrder(ids: string[], id: string, direction: "up" | "down"): boolean | null {
  const i = ids.indexOf(id);
  if (i === -1) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return false;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return true;
}

/** Jedan UPDATE za sve pozicije (0..n-1); uvjeti organizacije i roditelja su u upitu pa tuđe retke nije moguće dirati. */
async function writePositions(
  table: "nr_menu_categories" | "nr_menu_items",
  organizationId: string,
  scopeColumn: "menu_id" | "category_id",
  scopeId: string,
  orderedIds: string[]
) {
  if (orderedIds.length === 0) return;
  const values = sql.join(
    orderedIds.map((id, i) => sql`(${id}::text, ${i}::int)`),
    sql`, `
  );
  await db.execute(
    sql`update ${sql.identifier(table)} as t set position = v.pos from (values ${values}) as v(id, pos)
        where t.id = v.id and t.organization_id = ${organizationId} and t.${sql.identifier(scopeColumn)} = ${scopeId}`
  );
}

// --- Brzi uvoz iz teksta ---

export type ImportOptions = {
  /** preview: samo razlaže tekst (ništa se ne sprema); save: sprema u jelovnik. */
  mode: "preview" | "save";
  /** true = prije spremanja briše sve postojeće kategorije i stavke; false (zadano) = dodaje na kraj, spaja istoimene kategorije. */
  replace?: boolean;
};
export type ImportResult = {
  mode: "preview" | "save";
  parsed: ParsedMenu;
  /** Što je stvarno spremljeno (samo za mode "save"). */
  saved: { categories: number; items: number } | null;
  /** Koliko kategorija i stavki jelovnik trenutno ima (prije spremanja). */
  existing: { categories: number; items: number };
};

const importSchema = z
  .string({ error: "Tekst za uvoz: neispravan unos" })
  .max(MENU_LIMITS.importChars, `Tekst za uvoz: najviše ${MENU_LIMITS.importChars} znakova`);

/**
 * Brzi uvoz: zalijepljeni tekst (kategorije bez cijene, stavke "Naziv ... 5,50", opis iza " - " ili u idućem retku;
 * pravila su u lib/recenzije/menu-import.ts). "preview" vraća što bi nastalo, "save" to sprema u jednoj transakciji
 * (ili cijelo ili ništa) i odbija ako bi se prekoračila ograničenja jelovnika.
 */
export async function importMenuFromText(organizationId: string, text: string, opts: ImportOptions): Promise<MenuResult<ImportResult>> {
  const w = await writableMenu(organizationId);
  if (!w.ok) return w;
  const m = w.value;
  const t = importSchema.safeParse(text);
  if (!t.success) return zodFail(t.error);
  const parsed = parseMenuText(t.data);

  const [[{ nc }], [{ ni }]] = await Promise.all([
    db.select({ nc: count() }).from(menuCategories).where(eq(menuCategories.menuId, m.menu.id)),
    db.select({ ni: count() }).from(menuItems).where(eq(menuItems.menuId, m.menu.id)),
  ]);
  const existing = { categories: nc, items: ni };
  if (opts.mode === "preview") return ok({ mode: "preview", parsed, saved: null, existing });

  if (parsed.stats.items === 0) return fail("U tekstu nema prepoznatih stavki. Svaka stavka mora završavati cijenom (npr. Margherita 8,50).");

  return db.transaction(async (tx) => {
    if (opts.replace) await tx.delete(menuCategories).where(and(eq(menuCategories.menuId, m.menu.id), eq(menuCategories.organizationId, organizationId)));

    const cats = await tx
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.menuId, m.menu.id), eq(menuCategories.organizationId, organizationId)))
      .orderBy(asc(menuCategories.position));
    const byName = new Map(cats.map((c) => [c.name.toLocaleLowerCase("hr"), c]));
    const newCategories = parsed.categories.filter((c) => !byName.has(c.name.toLocaleLowerCase("hr")));
    const [{ n: itemTotal }] = await tx.select({ n: count() }).from(menuItems).where(eq(menuItems.menuId, m.menu.id));
    if (cats.length + newCategories.length > MENU_LIMITS.maxCategories) {
      return fail(`Jelovnik bi imao više od ${MENU_LIMITS.maxCategories} kategorija. Uključite "zamijeni postojeće" ili uklonite kategorije.`);
    }
    if (itemTotal + parsed.stats.items > MENU_LIMITS.maxItems) {
      return fail(`Jelovnik bi imao više od ${MENU_LIMITS.maxItems} stavki. Uključite "zamijeni postojeće" ili uklonite stavke.`);
    }

    let catPosition = cats.length ? Math.max(...cats.map((c) => c.position)) + 1 : 0;
    let savedItems = 0;
    for (const pc of parsed.categories) {
      let cat = byName.get(pc.name.toLocaleLowerCase("hr"));
      if (!cat) {
        [cat] = await tx
          .insert(menuCategories)
          .values({ menuId: m.menu.id, organizationId, name: pc.name, position: catPosition++ })
          .returning();
        byName.set(pc.name.toLocaleLowerCase("hr"), cat);
      }
      const [{ v }] = await tx.select({ v: max(menuItems.position) }).from(menuItems).where(eq(menuItems.categoryId, cat.id));
      let position = (v ?? -1) + 1;
      await tx.insert(menuItems).values(
        pc.items.map((it) => ({
          menuId: m.menu.id,
          categoryId: cat.id,
          organizationId,
          name: it.name,
          description: it.description,
          priceCents: it.priceCents,
          position: position++,
        }))
      );
      savedItems += pc.items.length;
    }
    return ok({ mode: "save" as const, parsed, saved: { categories: newCategories.length, items: savedItems }, existing });
  });
}

// --- Javno čitanje (po adresi) ---

export type PublicMenuInfo = {
  /** Id jelovnika (ne tvrtke): koristi se za ime i potpis kolačića (guest-cookie). */
  id: string;
  slug: string;
  /** Naziv lokala (naziv tvrtke). */
  venueName: string;
  /** Naslov koji gost vidi: zadani naslov druge vrste je već zamijenjen zadanim naslovom odabrane vrste (displayMenuTitle). */
  title: string;
  intro: string | null;
  introEn: string | null;
  externalUrl: string | null;
  /** Logo lokala (https adresa) ili null: tada se prikazuje naziv lokala. */
  logoUrl: string | null;
  allowSkip: boolean;
  delayMinutes: number;
  /** "jelovnik" ili "meni": svaki javni tekst uzima oblik iz lib/recenzije/menu-noun.ts. */
  menuKind: MenuKind;
  /** Lokal šalje i povremene obavijesti: gost vidi drugu varijantu privole (guest-consent.ts). */
  noticesEnabled: boolean;
  /** True kad ima ijedan engleski tekst: tek tada stranica prikazuje HR/EN prekidač. */
  hasEnglish: boolean;
};
export type PublicItem = {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  priceCents: number;
  allergens: string | null;
  available: boolean;
};
export type PublicCategory = { id: string; name: string; nameEn: string | null; items: PublicItem[] };
export type PublicMenu = PublicMenuInfo & { categories: PublicCategory[] };

/** Normalizira adresu iz URL-a; null kad nikad ne može biti ispravna (nema upita prema bazi). */
export function normalizePublicSlug(raw: string): string | null {
  const s = decodeSafe(raw).trim().toLowerCase();
  const v = validateMenuSlug(s);
  return v.ok ? v.slug : null;
}

function decodeSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Zaglavlje javnog jelovnika (bez stavki): dovoljno za vrata (naziv lokala, odgodu za tekst privole, postavke).
 * Ugašen jelovnik ili tvrtka koja nije ugostiteljska = null (stranica 404).
 */
export async function getPublicMenuInfoBySlug(rawSlug: string): Promise<PublicMenuInfo | null> {
  const slug = normalizePublicSlug(rawSlug);
  if (!slug) return null;
  await ensureReviewsDb();
  const [row] = await db
    .select({
      id: menus.id,
      slug: menus.slug,
      venueName: organizations.name,
      title: menus.title,
      intro: menus.intro,
      introEn: menus.introEn,
      externalUrl: menus.externalUrl,
      logoUrl: menus.logoUrl,
      allowSkip: menus.allowSkip,
      delayMinutes: menus.delayMinutes,
      menuKind: menus.menuKind,
      noticesEnabled: menus.noticesEnabled,
      hasEnglish: sql<boolean>`(
        coalesce(${menus.introEn}, '') <> ''
        or exists (select 1 from nr_menu_categories c where c.menu_id = ${menus.id} and coalesce(c.name_en, '') <> '')
        or exists (select 1 from nr_menu_items i where i.menu_id = ${menus.id} and (coalesce(i.name_en, '') <> '' or coalesce(i.description_en, '') <> ''))
      )`,
    })
    .from(menus)
    .innerJoin(organizations, eq(organizations.id, menus.organizationId))
    .where(and(eq(menus.slug, slug), eq(menus.enabled, true), eq(organizations.isVenue, true)))
    .limit(1);
  if (!row) return null;
  const menuKind = parseMenuKind(row.menuKind);
  return { ...row, menuKind, title: displayMenuTitle(menuKind, row.title) };
}

/**
 * Cijeli javni jelovnik. Vraća samo javna polja (nikad id tvrtke, brojeve ni goste); kategorije bez stavki se ne
 * prikazuju. Nedostupne stavke (available=false) ostaju u popisu s oznakom, a prikaz odlučuje hoće li ih zatamniti.
 */
export async function getPublicMenuBySlug(rawSlug: string): Promise<PublicMenu | null> {
  const info = await getPublicMenuInfoBySlug(rawSlug);
  if (!info) return null;
  const [cats, items] = await Promise.all([
    db
      .select({ id: menuCategories.id, name: menuCategories.name, nameEn: menuCategories.nameEn })
      .from(menuCategories)
      .where(eq(menuCategories.menuId, info.id))
      .orderBy(asc(menuCategories.position), asc(menuCategories.createdAt)),
    db
      .select({
        id: menuItems.id,
        categoryId: menuItems.categoryId,
        name: menuItems.name,
        nameEn: menuItems.nameEn,
        description: menuItems.description,
        descriptionEn: menuItems.descriptionEn,
        priceCents: menuItems.priceCents,
        allergens: menuItems.allergens,
        available: menuItems.available,
      })
      .from(menuItems)
      .where(eq(menuItems.menuId, info.id))
      .orderBy(asc(menuItems.position), asc(menuItems.createdAt)),
  ]);
  const byCat = new Map<string, PublicItem[]>();
  for (const { categoryId, ...it } of items) {
    const list = byCat.get(categoryId);
    if (list) list.push(it);
    else byCat.set(categoryId, [it]);
  }
  return {
    ...info,
    categories: cats.map((c) => ({ ...c, items: byCat.get(c.id) ?? [] })).filter((c) => c.items.length > 0),
  };
}
