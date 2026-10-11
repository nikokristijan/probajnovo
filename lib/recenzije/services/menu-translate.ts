import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { menuCategories, menuItems, menus, organizations, type Menu } from "@/lib/recenzije/db/schema";
import { TRANS_LANGS, type TransLang } from "@/lib/recenzije/menu-lang";
import {
  TRANSLATE_LIMITS,
  cleanMenuText,
  translateMenuEntities,
  type TranslateEntity,
} from "@/lib/recenzije/services/ai";
import type { MenuResult } from "@/lib/recenzije/services/menus";

/**
 * AI nacrt prijevoda jelovnika (EN / DE / IT) iz hrvatskog teksta.
 *
 * Pravila:
 * - NIKAD ne sprema bez operatera. translateTexts i draftMenuTranslations samo vraćaju nacrt; spremanje je zasebni korak
 *   (applyMenuTranslations) nakon što operater pregleda nacrt i potvrdi.
 * - Popunjava SAMO prazna polja prijevoda; postojeći prijevodi (i hrvatski tekst, cijene, alergeni) se nikad ne diraju,
 *   ni pri nacrtu ni pri spremanju (spremanje ponovno provjerava da je polje još prazno).
 * - Tekst jelovnika je podatak, nikad uputa: čisti se od kontrolnih znakova i oznaka, skraćuje, a model ga dobiva u oznakama
 *   s izričitom zabranom izvršavanja uputa; odgovor se validira zodom i svako polje se ponovno čisti i ograničava po duljini.
 * - Sve je vezano uz AKTIVNU tvrtku (organization_id u svakom upitu); demo radni prostor odbija pozivatelj (akcija).
 */

export const TRANSLATE_BATCH = 10;
export const MAX_APPLY_ENTRIES = 400;

export type DraftFields = Partial<
  Record<"nameEn" | "nameDe" | "nameIt" | "descriptionEn" | "descriptionDe" | "descriptionIt" | "introEn" | "introDe" | "introIt", string>
>;
export type DraftEntry = {
  kind: "category" | "item" | "intro";
  /** Id kategorije / stavke; za uvod id jelovnika. */
  id: string;
  /** Hrvatski tekst za prikaz u pregledu. */
  label: string;
  fields: DraftFields;
};

const fail = (error: string, field?: string): { ok: false; error: string; field?: string } => ({ ok: false, error, field });
const okv = <T>(value: T): MenuResult<T> => ({ ok: true, value });

const cap = (l: TransLang) => l[0].toUpperCase() + l.slice(1);
const key = (base: "name" | "description" | "intro", l: TransLang) => `${base}${cap(l)}` as keyof DraftFields;

export function parseLangs(raw: unknown): TransLang[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 3) return null;
  const set = new Set<TransLang>();
  for (const l of raw) {
    if (!TRANS_LANGS.includes(l as TransLang)) return null;
    set.add(l as TransLang);
  }
  return TRANS_LANGS.filter((l) => set.has(l));
}

/** Prevedi tekst iz obrasca (nespremljen). Šalje se samo ono što je prazno u obrascu (`need`). Ništa se ne sprema. */
export async function translateTexts(input: {
  kind: "category" | "item" | "intro";
  name?: string;
  description?: string;
  need: Partial<Record<TransLang, ("name" | "description")[]>>;
}): Promise<MenuResult<DraftFields>> {
  const max = input.kind === "intro" ? TRANSLATE_LIMITS.intro : TRANSLATE_LIMITS.description;
  const name = cleanMenuText(input.name ?? "", TRANSLATE_LIMITS.name);
  const description = cleanMenuText(input.description ?? "", max);
  const need: TranslateEntity["need"] = {};
  for (const l of TRANS_LANGS) {
    const want = (input.need[l] ?? []).filter((f) => (f === "name" ? name : description));
    // Uvod nema naziv: njegov jedini tekst je "description".
    const fields = want.filter((f) => (input.kind === "intro" ? f === "description" : input.kind === "category" ? f === "name" : true));
    if (fields.length) need[l] = [...new Set(fields)];
  }
  if (Object.keys(need).length === 0) return fail("Nema ničega za prevesti: hrvatski tekst je prazan ili su prijevodi već ispunjeni.");
  const out = await translateMenuEntities([{ ref: "e1", kind: input.kind, name: name || undefined, description: description || undefined, need }]);
  const got = out.get("e1");
  const fields: DraftFields = {};
  for (const l of TRANS_LANGS) {
    const g = got?.[l];
    if (!g) continue;
    if (input.kind === "intro") {
      if (g.description) fields[key("intro", l)] = g.description;
      continue;
    }
    if (g.name) fields[key("name", l)] = g.name;
    if (g.description && input.kind === "item") fields[key("description", l)] = g.description;
  }
  return okv(fields);
}

type Work = { entry: Omit<DraftEntry, "fields">; entity: Omit<TranslateEntity, "ref"> };

async function menuOf(organizationId: string): Promise<{ menu: Menu; isDemo: boolean } | null> {
  await ensureReviewsDb();
  const [row] = await db
    .select({ menu: menus, isVenue: organizations.isVenue, isDemo: organizations.isDemo })
    .from(menus)
    .innerJoin(organizations, eq(organizations.id, menus.organizationId))
    .where(eq(menus.organizationId, organizationId))
    .limit(1);
  if (!row || !row.isVenue) return null;
  return { menu: row.menu, isDemo: row.isDemo };
}

const empty = (v: string | null | undefined) => !v || !v.trim();

/** Svi unosi s hrvatskim tekstom i barem jednim praznim poljem prijevoda za odabrane jezike (uvod, kategorije, stavke po redoslijedu). */
async function workList(organizationId: string, menu: Menu, langs: TransLang[]): Promise<Work[]> {
  const [cats, items] = await Promise.all([
    db
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.menuId, menu.id), eq(menuCategories.organizationId, organizationId)))
      .orderBy(asc(menuCategories.position), asc(menuCategories.createdAt)),
    db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.menuId, menu.id), eq(menuItems.organizationId, organizationId)))
      .orderBy(asc(menuItems.position), asc(menuItems.createdAt)),
  ]);
  const catOrder = new Map(cats.map((c, i) => [c.id, i]));
  const sortedItems = [...items].sort((a, b) => (catOrder.get(a.categoryId) ?? 0) - (catOrder.get(b.categoryId) ?? 0) || a.position - b.position);
  const work: Work[] = [];
  const current = (rec: Record<string, unknown>, base: string, l: TransLang) => rec[`${base}${cap(l)}`] as string | null | undefined;

  if (menu.intro?.trim()) {
    const need: TranslateEntity["need"] = {};
    for (const l of langs) if (empty(current(menu, "intro", l))) need[l] = ["description"];
    if (Object.keys(need).length) work.push({ entry: { kind: "intro", id: menu.id, label: menu.intro }, entity: { kind: "intro", description: menu.intro, need } });
  }
  for (const c of cats) {
    if (empty(c.name)) continue;
    const need: TranslateEntity["need"] = {};
    for (const l of langs) if (empty(current(c, "name", l))) need[l] = ["name"];
    if (Object.keys(need).length) work.push({ entry: { kind: "category", id: c.id, label: c.name }, entity: { kind: "category", name: c.name, need } });
  }
  for (const it of sortedItems) {
    if (empty(it.name)) continue;
    const need: TranslateEntity["need"] = {};
    for (const l of langs) {
      const f: ("name" | "description")[] = [];
      if (empty(current(it, "name", l))) f.push("name");
      if (!empty(it.description) && empty(current(it, "description", l))) f.push("description");
      if (f.length) need[l] = f;
    }
    if (Object.keys(need).length) {
      work.push({ entry: { kind: "item", id: it.id, label: it.name }, entity: { kind: "item", name: it.name, description: it.description ?? undefined, need } });
    }
  }
  return work;
}

export type BatchResult = {
  drafts: DraftEntry[];
  /** Koliko je unosa u ovom pozivu obrađeno i koliko ih ukupno čeka prijevod. */
  processed: number;
  total: number;
  /** Pomak za idući poziv; null kad je gotovo. */
  nextOffset: number | null;
};

/**
 * Jedan korak "Prevedi cijeli jelovnik": do TRANSLATE_BATCH unosa od `offset`-a u popisu onih kojima nedostaje prijevod.
 * Popis se računa iz baze pri svakom pozivu (ništa se ne sprema između poziva), pa pomak ostaje valjan dok operater ne mijenja jelovnik.
 */
export async function draftMenuTranslations(organizationId: string, input: { langs: TransLang[]; offset: number }): Promise<MenuResult<BatchResult>> {
  const m = await menuOf(organizationId);
  if (!m) return fail("Jelovnik je dostupan samo za ugostiteljstvo.");
  if (m.isDemo) return fail("Ovo je primjer za razgledavanje, izmjene su isključene.");
  const work = await workList(organizationId, m.menu, input.langs);
  const offset = Math.max(0, Math.floor(input.offset));
  const slice = work.slice(offset, offset + TRANSLATE_BATCH);
  if (slice.length === 0) return okv({ drafts: [], processed: 0, total: work.length, nextOffset: null });
  const entities: TranslateEntity[] = slice.map((w, i) => ({ ...w.entity, ref: `e${i + 1}` }));
  const out = await translateMenuEntities(entities);
  const drafts: DraftEntry[] = [];
  slice.forEach((w, i) => {
    const got = out.get(`e${i + 1}`);
    if (!got) return;
    const fields: DraftFields = {};
    for (const l of TRANS_LANGS) {
      const g = got[l];
      if (!g) continue;
      if (w.entry.kind === "intro") {
        if (g.description) fields[key("intro", l)] = g.description;
        continue;
      }
      if (g.name) fields[key("name", l)] = g.name;
      if (g.description && w.entry.kind === "item") fields[key("description", l)] = g.description;
    }
    if (Object.keys(fields).length) drafts.push({ ...w.entry, fields });
  });
  const next = offset + slice.length;
  return okv({ drafts, processed: slice.length, total: work.length, nextOffset: next < work.length ? next : null });
}

// --- Spremanje potvrđenog nacrta ---

const ALLOWED: Record<DraftEntry["kind"], readonly (keyof DraftFields)[]> = {
  category: ["nameEn", "nameDe", "nameIt"],
  item: ["nameEn", "nameDe", "nameIt", "descriptionEn", "descriptionDe", "descriptionIt"],
  intro: ["introEn", "introDe", "introIt"],
};

/** Najveća duljina polja prema vrsti (isto kao validacija pri ručnom spremanju). */
function maxFor(k: keyof DraftFields): number {
  return k.startsWith("name") ? TRANSLATE_LIMITS.name : k.startsWith("intro") ? TRANSLATE_LIMITS.intro : TRANSLATE_LIMITS.description;
}

export type ApplyResult = { applied: number; skipped: number };

/**
 * Sprema pregledane prijevode, ali samo u polja koja su u bazi još prazna (operater je u međuvremenu mogao nešto upisati).
 * Nepoznati ili tuđi id-evi i nedopuštena polja se preskaču. Sve u jednoj transakciji.
 */
export async function applyMenuTranslations(organizationId: string, entries: DraftEntry[]): Promise<MenuResult<ApplyResult>> {
  const m = await menuOf(organizationId);
  if (!m) return fail("Jelovnik je dostupan samo za ugostiteljstvo.");
  if (m.isDemo) return fail("Ovo je primjer za razgledavanje, izmjene su isključene.");
  if (entries.length > MAX_APPLY_ENTRIES) return fail(`Najviše ${MAX_APPLY_ENTRIES} unosa odjednom.`);
  let applied = 0;
  let skipped = 0;
  await db.transaction(async (tx) => {
    for (const e of entries) {
      const clean: Record<string, string> = {};
      for (const k of ALLOWED[e.kind] ?? []) {
        const raw = e.fields[k];
        if (typeof raw !== "string") continue;
        const v = cleanMenuText(raw, maxFor(k) + 1);
        if (v && v.length <= maxFor(k)) clean[k] = v;
      }
      const names = Object.keys(clean);
      if (names.length === 0) continue;

      const table = e.kind === "intro" ? menus : e.kind === "category" ? menuCategories : menuItems;
      const idCol = e.kind === "intro" ? menus.id : e.kind === "category" ? menuCategories.id : menuItems.id;
      const scope =
        e.kind === "intro"
          ? and(eq(menus.id, m.menu.id), eq(menus.organizationId, organizationId))
          : and(eq(idCol, e.id), eq((table as typeof menuItems).organizationId, organizationId), eq((table as typeof menuItems).menuId, m.menu.id));
      if (e.kind === "intro" && e.id !== m.menu.id) {
        skipped += names.length;
        continue;
      }
      const [cur] = (await tx.select().from(table as typeof menuItems).where(scope).limit(1)) as Record<string, unknown>[];
      if (!cur) {
        skipped += names.length;
        continue;
      }
      const set: Record<string, unknown> = {};
      for (const n of names) {
        const existing = cur[n];
        if (typeof existing === "string" && existing.trim()) {
          skipped++;
          continue;
        }
        const col = (table as unknown as Record<string, { name: string }>)[n];
        // Zaštita od utrke: polje se mijenja samo ako je i u trenutku upisa prazno.
        set[n] = sql`case when coalesce(${sql.raw(`"${col.name}"`)}, '') = '' then ${clean[n]} else ${sql.raw(`"${col.name}"`)} end`;
        applied++;
      }
      if (Object.keys(set).length === 0) continue;
      await tx.update(table as typeof menuItems).set(set).where(scope);
    }
  });
  return okv({ applied, skipped });
}
