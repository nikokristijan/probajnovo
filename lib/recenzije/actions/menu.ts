"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parsePriceToCents } from "@/lib/recenzije/menu-format";
import type { ParsedMenu } from "@/lib/recenzije/menu-import";
import { validateMenuSlug } from "@/lib/recenzije/menu-slug";
import { requireOrg, requireWritableOrg } from "@/lib/recenzije/session";
import { integrations } from "@/lib/recenzije/env";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { AiNotConfiguredError, AiRequestError } from "@/lib/recenzije/services/ai";
import {
  applyMenuTranslations,
  draftMenuTranslations,
  parseLangs,
  translateTexts,
  MAX_APPLY_ENTRIES,
  type ApplyResult,
  type BatchResult,
  type DraftFields,
} from "@/lib/recenzije/services/menu-translate";
import {
  checkMenuSlug,
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  ensureVenueMenu,
  importMenuFromText,
  menuPublicUrl,
  moveCategory,
  moveItem,
  updateCategory,
  updateItem,
  upsertMenuSettings,
  type MenuResult,
} from "@/lib/recenzije/services/menus";
import { listRecentGuests } from "@/lib/recenzije/services/guests";
import { buildQrMatrix, type QrMatrix } from "@/lib/recenzije/services/qr";
import { MAX_TABLES, toGuestView, type GuestView } from "@/components/recenzije/app/menu/menu-types";

/**
 * Akcije operatera za jelovnik (stranica /recenzije/jelovnik i način "Jelovnik" na QR plakatu). Svaka akcija:
 * 1) radi samo nad AKTIVNOM tvrtkom iz sesije (id tvrtke se nikad ne prima od preglednika),
 * 2) mijenjanje odbija na demo radnom prostoru (requireWritableOrg),
 * 3) provjerava oblik i duljinu ulaza zodom prije poziva servisa (servis dodatno validira sadržaj),
 * 4) vraća { ok, message, data } ili { ok: false, error, field? } s hrvatskim tekstom, bez bacanja.
 */

export type MenuActionResult<T = null> = { ok: true; message: string; data: T } | { ok: false; error: string; field?: string };

const bad = (error: string, field?: string): { ok: false; error: string; field?: string } => ({ ok: false, error, field });
const good = <T>(message: string, data: T): MenuActionResult<T> => ({ ok: true, message, data });

const NOT_VENUE = "Jelovnik je dostupan samo za ugostiteljstvo.";
const DEMO_LOCKED = "Ovo je primjer za razgledavanje, izmjene su isključene.";
const GUEST_PAGE = 25;

/** Servis zove polje cijene priceCents, a obrazac "price". */
const fieldName = (f: string | undefined) => (f === "priceCents" ? "price" : f);
function fromService<T, U>(r: MenuResult<T>, message: string, map: (v: T) => U): MenuActionResult<U> {
  return r.ok ? good(message, map(r.value)) : bad(r.error, fieldName(r.field));
}

type Fail = ReturnType<typeof bad>;

/** Aktivna ugostiteljska tvrtka koja smije mijenjati podatke; inače `deny` s gotovim odgovorom. */
async function writable(): Promise<{ deny: Fail; orgId?: undefined } | { deny?: undefined; orgId: string }> {
  const { ctx, locked } = await requireWritableOrg();
  if (locked) return { deny: bad(locked.error ?? DEMO_LOCKED) };
  if (!ctx.org.isVenue) return { deny: bad(NOT_VENUE) };
  return { orgId: ctx.org.id };
}

function refresh(opts?: { poster?: boolean }) {
  revalidatePath("/recenzije/jelovnik");
  // Javni prikaz (kolačić + baza) nije keširan, ali promjena adrese ili sadržaja ne smije ostati u nijednoj keš razini.
  revalidatePath("/jelovnik/[slug]", "page");
  if (opts?.poster) revalidatePath("/recenzije/plakat");
}

function firstIssue(err: z.ZodError) {
  const i = err.issues[0];
  return bad(i?.message ?? "Neispravan unos.", typeof i?.path[0] === "string" ? i.path[0] : undefined);
}

// --- Ulazni oblici (granice duljine; sadržaj validira servis) ---

const idSchema = z.string({ error: "Nedostaje oznaka." }).min(1, "Nedostaje oznaka.").max(60, "Neispravna oznaka.");
const dirSchema = z.enum(["up", "down"], { error: "Neispravan smjer." });
const shortText = (max: number) => z.string({ error: "Neispravan unos." }).max(max, `Najviše ${max} znakova.`);
const optionalText = (max: number) => shortText(max).nullish();

const settingsSchema = z.object({
  slug: shortText(80).optional(),
  title: shortText(300).optional(),
  intro: optionalText(3000),
  introEn: optionalText(3000),
  introDe: optionalText(3000),
  introIt: optionalText(3000),
  externalUrl: optionalText(1200),
  logoUrl: optionalText(1200),
  allowSkip: z.boolean({ error: "Neispravan unos." }).optional(),
  menuKind: z.enum(["jelovnik", "meni"], { error: "Neispravan unos." }).optional(),
  noticesEnabled: z.boolean({ error: "Neispravan unos." }).optional(),
  captureEnabled: z.boolean({ error: "Neispravan unos." }).optional(),
  showReviewButton: z.boolean({ error: "Neispravan unos." }).optional(),
  wifiName: optionalText(500),
  wifiPassword: optionalText(500),
  contactPhone: optionalText(500),
  contactEmail: optionalText(500),
  contactAddress: optionalText(500),
  contactInstagram: optionalText(500),
  delayMinutes: z.number({ error: "Odgoda mora biti broj minuta." }).int("Odgoda mora biti cijeli broj minuta.").optional(),
  enabled: z.boolean({ error: "Neispravan unos." }).optional(),
});
export type MenuSettingsPatch = z.input<typeof settingsSchema>;

const categorySchema = z.object({ name: shortText(300), nameEn: optionalText(300), nameDe: optionalText(300), nameIt: optionalText(300) });
export type CategoryFormInput = z.input<typeof categorySchema>;

const itemSchema = z.object({
  name: shortText(300),
  nameEn: optionalText(300),
  nameDe: optionalText(300),
  nameIt: optionalText(300),
  description: optionalText(1500),
  descriptionEn: optionalText(1500),
  descriptionDe: optionalText(1500),
  descriptionIt: optionalText(1500),
  /** Cijena kako je upisana ("5,50"); pretvara se u cente ovdje. */
  price: shortText(30),
  allergens: optionalText(600),
  available: z.boolean({ error: "Neispravan unos." }).optional(),
  categoryId: idSchema.optional(),
});
export type ItemFormInput = z.input<typeof itemSchema>;

const PRICE_ERROR = "Cijena: upišite iznos u eurima, npr. 5,50.";
const centsOf = (text: string): number | null => (text.trim() ? parsePriceToCents(text) : null);

// --- Postavke jelovnika ---

export async function saveMenuSettingsAction(input: MenuSettingsPatch): Promise<MenuActionResult<{ slug: string }>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const p = settingsSchema.safeParse(input);
  if (!p.success) return firstIssue(p.error);
  const r = await upsertMenuSettings(w.orgId, p.data);
  if (!r.ok) return bad(r.error, r.field);
  refresh({ poster: p.data.slug !== undefined });
  return good("Postavke jelovnika su spremljene.", { slug: r.value.slug });
}

export async function setMenuEnabledAction(enabled: boolean): Promise<MenuActionResult<null>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const p = z.boolean().safeParse(enabled);
  if (!p.success) return bad("Neispravan unos.");
  const r = await upsertMenuSettings(w.orgId, { enabled: p.data });
  if (!r.ok) return bad(r.error, r.field);
  refresh();
  return good(p.data ? "Jelovnik je uključen. Gosti ga mogu otvoriti." : "Jelovnik je isključen. Stranica gostima prikazuje grešku.", null);
}

/** Provjera adrese dok operater tipka (oblik + je li slobodna). Čita samo, pa radi i na demo radnom prostoru. */
export async function checkMenuSlugAction(slug: string): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  if (!ctx.org.isVenue) return { ok: false, error: NOT_VENUE };
  const p = shortText(80).safeParse(slug);
  if (!p.success) return { ok: false, error: "Adresa je predugačka." };
  const local = validateMenuSlug(p.data);
  if (!local.ok) return { ok: false, error: local.error };
  const r = await checkMenuSlug(local.slug, ctx.org.id);
  return r.ok ? { ok: true, slug: r.value } : { ok: false, error: r.error };
}

// --- Kategorije ---

export async function createCategoryAction(input: CategoryFormInput): Promise<MenuActionResult<{ id: string }>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const p = categorySchema.safeParse(input);
  if (!p.success) return firstIssue(p.error);
  const r = await createCategory(w.orgId, p.data);
  if (r.ok) refresh();
  return fromService(r, "Kategorija je dodana.", (c) => ({ id: c.id }));
}

export async function updateCategoryAction(categoryId: string, input: CategoryFormInput): Promise<MenuActionResult<null>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const id = idSchema.safeParse(categoryId);
  const p = categorySchema.safeParse(input);
  if (!id.success) return bad(id.error.issues[0].message);
  if (!p.success) return firstIssue(p.error);
  const r = await updateCategory(w.orgId, id.data, p.data);
  if (r.ok) refresh();
  return fromService(r, "Kategorija je spremljena.", () => null);
}

export async function deleteCategoryAction(categoryId: string): Promise<MenuActionResult<{ deletedItems: number }>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return bad(id.error.issues[0].message);
  const r = await deleteCategory(w.orgId, id.data);
  if (r.ok) refresh();
  return fromService(r, "Kategorija je obrisana.", (v) => ({ deletedItems: v.deletedItems }));
}

export async function moveCategoryAction(categoryId: string, direction: "up" | "down"): Promise<MenuActionResult<null>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const id = idSchema.safeParse(categoryId);
  const dir = dirSchema.safeParse(direction);
  if (!id.success || !dir.success) return bad("Neispravan unos.");
  const r = await moveCategory(w.orgId, id.data, dir.data);
  if (r.ok && r.value.moved) refresh();
  return fromService(r, "", () => null);
}

// --- Stavke ---

export async function createItemAction(categoryId: string, input: ItemFormInput): Promise<MenuActionResult<{ id: string }>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const cat = idSchema.safeParse(categoryId);
  const p = itemSchema.safeParse(input);
  if (!cat.success) return bad(cat.error.issues[0].message);
  if (!p.success) return firstIssue(p.error);
  const cents = centsOf(p.data.price);
  if (cents === null) return bad(PRICE_ERROR, "price");
  const d = p.data;
  const r = await createItem(w.orgId, cat.data, {
    name: d.name,
    nameEn: d.nameEn,
    nameDe: d.nameDe,
    nameIt: d.nameIt,
    description: d.description,
    descriptionEn: d.descriptionEn,
    descriptionDe: d.descriptionDe,
    descriptionIt: d.descriptionIt,
    allergens: d.allergens,
    available: d.available,
    priceCents: cents,
  });
  if (r.ok) refresh();
  return fromService(r, "Stavka je dodana.", (it) => ({ id: it.id }));
}

export async function updateItemAction(itemId: string, input: ItemFormInput): Promise<MenuActionResult<null>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const id = idSchema.safeParse(itemId);
  const p = itemSchema.safeParse(input);
  if (!id.success) return bad(id.error.issues[0].message);
  if (!p.success) return firstIssue(p.error);
  const cents = centsOf(p.data.price);
  if (cents === null) return bad(PRICE_ERROR, "price");
  const d = p.data;
  const r = await updateItem(w.orgId, id.data, {
    name: d.name,
    nameEn: d.nameEn,
    nameDe: d.nameDe,
    nameIt: d.nameIt,
    description: d.description,
    descriptionEn: d.descriptionEn,
    descriptionDe: d.descriptionDe,
    descriptionIt: d.descriptionIt,
    allergens: d.allergens,
    available: d.available,
    categoryId: d.categoryId,
    priceCents: cents,
  });
  if (r.ok) refresh();
  return fromService(r, "Stavka je spremljena.", () => null);
}

export async function setItemAvailableAction(itemId: string, available: boolean): Promise<MenuActionResult<null>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const id = idSchema.safeParse(itemId);
  const a = z.boolean().safeParse(available);
  if (!id.success || !a.success) return bad("Neispravan unos.");
  const r = await updateItem(w.orgId, id.data, { available: a.data });
  if (r.ok) refresh();
  return fromService(r, a.data ? "Stavka je ponovno dostupna." : "Stavka je označena kao nedostupna.", () => null);
}

export async function deleteItemAction(itemId: string): Promise<MenuActionResult<null>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const id = idSchema.safeParse(itemId);
  if (!id.success) return bad(id.error.issues[0].message);
  const r = await deleteItem(w.orgId, id.data);
  if (r.ok) refresh();
  return fromService(r, "Stavka je obrisana.", () => null);
}

export async function moveItemAction(itemId: string, direction: "up" | "down"): Promise<MenuActionResult<null>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const id = idSchema.safeParse(itemId);
  const dir = dirSchema.safeParse(direction);
  if (!id.success || !dir.success) return bad("Neispravan unos.");
  const r = await moveItem(w.orgId, id.data, dir.data);
  if (r.ok && r.value.moved) refresh();
  return fromService(r, "", () => null);
}

// --- Prijevodi (AI nacrt) ---

const AI_OFF = "AI nije postavljen, pa automatski prijevod nije dostupan. Prijevode možete upisati ručno.";
const langsSchema = z.array(z.enum(["en", "de", "it"], { error: "Odaberite jezik." }), { error: "Odaberite jezik." }).min(1, "Odaberite barem jedan jezik.").max(3);

/** Pozivi prema AI-ju po tvrtki: 40 u 10 minuta (cijeli jelovnik od 200 stavki je oko 20 poziva). */
function aiGate(orgId: string): Fail | null {
  if (!integrations.ai()) return bad(AI_OFF);
  const rl = rateLimit(`menu-translate:${orgId}`, 40, 10 * 60_000);
  return rl.ok ? null : bad(`Previše zahtjeva za prijevod. Pokušajte ponovno za ${Math.max(1, Math.ceil(rl.retryAfter / 60))} min.`);
}

function aiError(e: unknown): Fail {
  if (e instanceof AiNotConfiguredError) return bad(AI_OFF);
  if (e instanceof AiRequestError) return bad(e.message);
  console.error("[recenzije] prijevod jelovnika", e instanceof Error ? e.message : e);
  return bad("Prijevod nije uspio. Pokušajte ponovno.");
}

const fieldsText = z.string().max(700);
const translateTextsSchema = z.object({
  kind: z.enum(["category", "item", "intro"]),
  /** Hrvatski tekst iz obrasca (nespremljen). */
  name: z.string().max(400).optional(),
  description: z.string().max(3000).optional(),
  /** Koja polja su prazna u obrascu i treba ih prevesti, po jeziku. */
  need: z.object({
    en: z.array(z.enum(["name", "description"])).max(2).optional(),
    de: z.array(z.enum(["name", "description"])).max(2).optional(),
    it: z.array(z.enum(["name", "description"])).max(2).optional(),
  }),
});

/**
 * "Prevedi (AI nacrt)" u obrascu stavke, kategorije ili uvoda: vraća nacrt za prazna polja koja je obrazac naveo. Ništa se ne
 * sprema; operater nacrt vidi u poljima obrasca, pregleda ga i tek tada sprema obrazac.
 */
export async function translateTextsAction(input: z.input<typeof translateTextsSchema>): Promise<MenuActionResult<{ fields: DraftFields }>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const p = translateTextsSchema.safeParse(input);
  if (!p.success) return firstIssue(p.error);
  const gate = aiGate(w.orgId);
  if (gate) return gate;
  try {
    const r = await translateTexts(p.data);
    if (!r.ok) return bad(r.error);
    if (Object.keys(r.value).length === 0) return bad("AI nije vratio prijevod. Pokušajte ponovno.");
    return good("AI nacrt je upisan u prazna polja. Provjerite ga prije spremanja.", { fields: r.value });
  } catch (e) {
    return aiError(e);
  }
}

/** Jedan korak "Prevedi cijeli jelovnik": nacrt za do 10 unosa kojima nedostaje prijevod. Ništa se ne sprema. */
export async function draftMenuTranslationsAction(input: { langs: string[]; offset: number }): Promise<MenuActionResult<BatchResult>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const langs = langsSchema.safeParse(input.langs);
  const offset = z.number().int().min(0).max(100_000).safeParse(input.offset);
  if (!langs.success) return bad(langs.error.issues[0].message);
  if (!offset.success) return bad("Neispravan unos.");
  const gate = aiGate(w.orgId);
  if (gate) return gate;
  try {
    const parsed = parseLangs(langs.data);
    if (!parsed) return bad("Odaberite jezik.");
    const r = await draftMenuTranslations(w.orgId, { langs: parsed, offset: offset.data });
    return r.ok ? good("", r.value) : bad(r.error);
  } catch (e) {
    return aiError(e);
  }
}

const applySchema = z
  .array(
    z.object({
      kind: z.enum(["category", "item", "intro"]),
      id: idSchema,
      label: z.string().max(400),
      fields: z.record(z.string(), fieldsText),
    }),
    { error: "Neispravan unos." }
  )
  .max(MAX_APPLY_ENTRIES, `Najviše ${MAX_APPLY_ENTRIES} unosa odjednom.`);

/** Sprema pregledani (i po želji ispravljeni) nacrt prijevoda, ali samo u polja koja su još prazna. */
export async function applyMenuTranslationsAction(entries: z.input<typeof applySchema>): Promise<MenuActionResult<ApplyResult>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const p = applySchema.safeParse(entries);
  if (!p.success) return bad(p.error.issues[0]?.message ?? "Neispravan unos.");
  const r = await applyMenuTranslations(w.orgId, p.data as Parameters<typeof applyMenuTranslations>[1]);
  if (!r.ok) return bad(r.error);
  refresh();
  const { applied, skipped } = r.value;
  return good(
    applied > 0 ? `Spremljeno prijevoda: ${applied}.${skipped ? ` Preskočeno ${skipped} (polje je već ispunjeno).` : ""}` : "Ništa nije spremljeno: sva su polja već ispunjena.",
    r.value
  );
}

// --- Brzi uvoz ---

const importText = z.string({ error: "Tekst za uvoz: neispravan unos." }).max(20_000, "Tekst za uvoz: najviše 20 000 znakova.");

export type ImportPreviewData = { parsed: ParsedMenu; existing: { categories: number; items: number } };

/** Razlaže zalijepljeni tekst i vraća što bi nastalo. Ništa ne sprema (pa radi i na demo radnom prostoru). */
export async function previewMenuImportAction(text: string): Promise<MenuActionResult<ImportPreviewData>> {
  const ctx = await requireOrg();
  if (!ctx.org.isVenue) return bad(NOT_VENUE);
  const t = importText.safeParse(text);
  if (!t.success) return bad(t.error.issues[0].message, "text");
  const r = await importMenuFromText(ctx.org.id, t.data, { mode: "preview" });
  if (!r.ok) return bad(r.error, "text");
  return good("", { parsed: r.value.parsed, existing: r.value.existing });
}

export async function saveMenuImportAction(text: string, replace: boolean): Promise<MenuActionResult<{ categories: number; items: number }>> {
  const w = await writable();
  if (w.deny) return w.deny;
  const t = importText.safeParse(text);
  if (!t.success) return bad(t.error.issues[0].message, "text");
  const r = await importMenuFromText(w.orgId, t.data, { mode: "save", replace: replace === true });
  if (!r.ok) return bad(r.error, "text");
  refresh();
  const saved = r.value.saved ?? { categories: 0, items: 0 };
  return good(`Spremljeno: ${saved.items} stavki${saved.categories ? ` u ${saved.categories} novih kategorija` : ""}.`, saved);
}

// --- Gosti ---

/** Idućih 25 unosa gostiju (najnoviji prvi), s maskiranim brojem i stanjem poruke. */
export async function loadMoreGuestsAction(offset: number): Promise<MenuActionResult<{ rows: GuestView[]; hasMore: boolean }>> {
  const ctx = await requireOrg();
  if (!ctx.org.isVenue) return bad(NOT_VENUE);
  const o = z.number().int().min(0).max(100_000).safeParse(offset);
  if (!o.success) return bad("Neispravan unos.");
  const rows = await listRecentGuests(ctx.org.id, GUEST_PAGE + 1, o.data);
  const now = new Date();
  return good("", {
    rows: rows.slice(0, GUEST_PAGE).map((r) => toGuestView(r, ctx.org.timezone, now)),
    hasMore: rows.length > GUEST_PAGE,
  });
}

// --- QR kodovi za plakat (način "Jelovnik") ---

export type MenuQr = QrMatrix & { url: string };

/** Dopušteno: do 12 znakova (slova, brojevi, razmak, točka, crtica, podvlaka). Prazno = bez stola. */
const tableSchema = z
  .string({ error: "Broj stola: neispravan unos." })
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(z.string().regex(/^[\p{L}\p{N} ._-]{0,12}$/u, "Broj stola: najviše 12 znakova (slova, brojevi, crtica)."));

async function venueMenuForQr(): Promise<{ deny: Fail; slug?: undefined } | { deny?: undefined; slug: string }> {
  const ctx = await requireOrg();
  if (!ctx.org.isVenue) return { deny: bad(NOT_VENUE) };
  const menu = await ensureVenueMenu(ctx.org.id);
  if (!menu) return { deny: bad(NOT_VENUE) };
  return { slug: menu.slug };
}

/** QR za javnu adresu jelovnika s neobaveznim brojem stola (?stol=). Adresa se uvijek gradi iz baze, nikad iz ulaza. */
export async function buildMenuQrAction(table: string): Promise<MenuActionResult<MenuQr>> {
  const m = await venueMenuForQr();
  if (m.deny) return m.deny;
  const t = tableSchema.safeParse(table);
  if (!t.success) return bad(t.error.issues[0].message, "table");
  const url = menuPublicUrl(m.slug, t.data || null);
  try {
    return good("", { ...buildQrMatrix(url), url });
  } catch (e) {
    console.error("[recenzije] QR jelovnika", e);
    return bad("QR kod se nije mogao napraviti. Skratite adresu jelovnika u Postavkama.");
  }
}

/** QR kodovi za stolove from..from+count-1 (A4 ploča sa svim stolovima). */
export async function buildMenuTableQrsAction(input: { count: number; from: number }): Promise<MenuActionResult<{ items: ({ label: string } & MenuQr)[] }>> {
  const m = await venueMenuForQr();
  if (m.deny) return m.deny;
  const p = z
    .object({
      count: z.number({ error: "Broj stolova: upišite broj." }).int("Broj stolova: upišite cijeli broj.").min(1, "Broj stolova: najmanje 1.").max(MAX_TABLES, `Broj stolova: najviše ${MAX_TABLES}.`),
      from: z.number({ error: "Prvi stol: upišite broj." }).int("Prvi stol: upišite cijeli broj.").min(0, "Prvi stol: najmanje 0.").max(9999, "Prvi stol: najviše 9999."),
    })
    .safeParse(input);
  if (!p.success) return firstIssue(p.error);
  try {
    const items = Array.from({ length: p.data.count }, (_, i) => {
      const label = String(p.data.from + i);
      const url = menuPublicUrl(m.slug, label);
      return { label, url, ...buildQrMatrix(url) };
    });
    return good("", { items });
  } catch (e) {
    console.error("[recenzije] QR stolova", e);
    return bad("QR kodovi se nisu mogli napraviti. Skratite adresu jelovnika u Postavkama.");
  }
}
