import { parsePriceToCents } from "./menu-format";

/**
 * Brzi uvoz jelovnika iz običnog teksta (zalijepi iz Worda, PDF-a ili poruke). Čista funkcija bez baze i bez
 * server-only: sučelje je zove za pregled (što će nastati) prije spremanja, a poslužitelj je zove ponovno pri spremanju.
 *
 * Pravila (jedan redak = jedna stvar):
 * - Redak koji ZAVRŠAVA cijenom je stavka: "Margherita 8,50", "Margherita ........ 8,50 €", "Margherita - rajčica, sir 8,50".
 *   Cijena može biti 5,50 / 5.50 / 5,5 / 5 / 2,- (cijeli iznos) / €5,50 / 5,50 EUR / 1.250,00. Naziv je tekst ispred cijene; ako u njemu
 *   ima " - ", ono iza je opis. Opis može doći i iza cijene ("Cappuccino 2,00 - s mlijekom"), ako cijena ima dvije
 *   decimale ili oznaku valute.
 * - Redak BEZ cijene je naziv kategorije ("Pizze", "PIZZE", "Pizze:", "# Pizze", "=== Pizze ===") ili opis prethodne stavke.
 *   Opis je kad redak odmah slijedi stavku (bez praznog retka između) i izgleda kao opis: počinje malim slovom, ima zarez,
 *   dulji je od četiri riječi ili 45 znakova, ili počinje crticom/točkom ("- rajčica, sir"). Sve ostalo je nova kategorija.
 *   Praznim retkom (ili retkom "# Naziv") uvijek se otvara nova kategorija.
 * - Stavke prije prve kategorije idu u kategoriju "Ostalo". Kategorije bez stavki se preskaču. Isti naziv kategorije se spaja.
 * - Cijena može stajati i u idućem retku: "Margherita" + "8,50", ili "Margherita" + "rajčica, sir" + "8,50" (retci bez praznine).
 * - Retci bez slova ("-----", "12") i predugi retci se preskaču uz upozorenje; ništa se ne gubi tiho osim samih crta.
 */

export const IMPORT_LIMITS = {
  maxChars: 20_000,
  maxLineChars: 300,
  maxItems: 600,
  maxCategories: 40,
  nameChars: 120,
  descriptionChars: 400,
} as const;

export const DEFAULT_IMPORT_CATEGORY = "Ostalo";

export type ParsedItem = { name: string; description: string | null; priceCents: number; line: number };
export type ParsedCategory = { name: string; items: ParsedItem[]; line: number };
export type ParseWarning = { line: number; message: string };
export type ParsedMenu = {
  categories: ParsedCategory[];
  warnings: ParseWarning[];
  stats: { categories: number; items: number; skippedLines: number };
};

const LEADERS = "\\s.…_\\-–—:/·";
const CURRENCY = "(?:€|eur(?:a|o|e)?|euro)";
/** Cijena na kraju retka: iza razmaka ili vodilice, uz neobavezne oznake valute i završnu točku. */
const END_PRICE = new RegExp(`(^|[${LEADERS}])((?:€\\s*)?\\d{1,6}(?:[.,]\\d{1,3})*(?:\\s*${CURRENCY})?)\\s*[.;,]?\\s*$`, "i");
/** Cijena nakon koje slijedi " - opis". */
const MID_PRICE = new RegExp(`^(.*?)[${LEADERS}]+((?:€\\s*)?\\d{1,6}(?:[.,]\\d{1,3})*(?:\\s*${CURRENCY})?)\\s+[-–—]\\s+(.+)$`, "i");
/** Redak koji je samo cijena ("8,50", "€ 8", "12 EUR"): u tekstu iz PDF-a cijena često stoji ispod naziva. */
const PRICE_ONLY = new RegExp(`^(?:€\\s*)?\\d{1,6}(?:[.,]\\d{1,3})*(?:\\s*${CURRENCY})?\\s*[.;]?$`, "i");
const ANY_PRICE_IN_TEXT = /\d{1,6}[.,]\d{2}(?!\d)/g;
const LETTER = /\p{L}/u;
const DECORATION = /^[\s=\-–—*_~#.:·•]+|[\s=\-–—*_~#.:·•]+$/g;

function collapse(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function toCents(priceText: string): number | null {
  return parsePriceToCents(priceText);
}

/** Cijena s crticom umjesto decimala ("Kava 2,-", "Čaj 2.- €") je cijeli iznos: pretvara se u "2,00" prije razlaganja retka. */
// Završetak retka bez susjednih \s* (isti razmaci se ne smiju moći podijeliti na više načina): s ovakvim uzorkom
// redak "1,-" + tisuće razmaka + "x" daje kubično vrijeme. Predugi retci se ionako preskaču pa se ovdje ne diraju.
const DASH_PRICE = new RegExp(`(\\d)\\s*[,.]\\s*[-–—]{1,2}(?=(?:\\s*${CURRENCY})?[\\s.;,]*$)`, "i");
function normalizeDashPrice(line: string): string {
  if (line.length > IMPORT_LIMITS.maxLineChars) return line;
  return line.replace(DASH_PRICE, "$1,00");
}

/** Redak koji sadrži cijenu s dvije decimale ili oznakom valute (ali ne mjeru poput "0,33 l"). */
function containsPrice(t: string): boolean {
  return /€|\beur(?:a|o|e)?\b/i.test(t) || /\d[.,]\d{2}(?!\d)(?!\s*(?:l|dl|cl|ml|g|kg|%)(?![\p{L}]))/iu.test(t);
}

function isAllCaps(s: string) {
  const letters = s.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toLocaleUpperCase("hr") && letters !== letters.toLocaleLowerCase("hr");
}

function sentenceCase(s: string) {
  const lower = s.toLocaleLowerCase("hr");
  return lower.charAt(0).toLocaleUpperCase("hr") + lower.slice(1);
}

function cleanHeading(raw: string) {
  let h = raw.replace(DECORATION, "");
  h = collapse(h);
  if (isAllCaps(h) && h.length >= 4) h = sentenceCase(h);
  return h;
}

/** Cijena mora imati dvije decimale ili oznaku valute da bi se čitala usred retka ("Pivo 0,5 - hladno" nije cijena). */
function looksLikeDeliberatePrice(priceText: string) {
  return /[.,]\d{2}\D*$/.test(priceText) || /€|eur/i.test(priceText);
}

function descriptionLike(t: string) {
  const words = t.split(/\s+/).length;
  return /^\p{Ll}/u.test(t) || t.includes(",") || words > 4 || t.length > 45;
}

/** Razdvaja "Naziv - opis". Prvi " - " dijeli; ako s jedne strane nema slova, ne dijeli. */
function splitNameDescription(body: string): { name: string; description: string | null } {
  const m = body.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m && LETTER.test(m[1]) && LETTER.test(m[2])) return { name: collapse(m[1]), description: collapse(m[2]) };
  return { name: collapse(body), description: null };
}

export function parseMenuText(input: string): ParsedMenu {
  const warnings: ParseWarning[] = [];
  const categories: ParsedCategory[] = [];
  let skipped = 0;
  let itemCount = 0;
  // Stanje je u objektu (a ne u let varijablama) jer ga mijenjaju i funkcije unutar petlje.
  const st: { current: ParsedCategory | null; last: ParsedItem | null; blank: boolean } = { current: null, last: null, blank: true };
  let limitHit = false;
  let defaultCategoryWarned = false;

  const warn = (line: number, message: string) => warnings.push({ line, message });
  const skip = (line: number, message?: string) => {
    skipped++;
    if (message) warn(line, message);
  };

  const openCategory = (name: string, line: number) => {
    const existing = categories.find((c) => c.name.toLocaleLowerCase("hr") === name.toLocaleLowerCase("hr"));
    if (existing) {
      st.current = existing;
    } else if (categories.length >= IMPORT_LIMITS.maxCategories) {
      limitHit = true;
      warn(line, `Najviše ${IMPORT_LIMITS.maxCategories} kategorija po jelovniku: "${name}" je preskočena.`);
      st.current = null;
    } else {
      const trimmed = name.length > IMPORT_LIMITS.nameChars ? name.slice(0, IMPORT_LIMITS.nameChars).trim() : name;
      if (trimmed !== name) warn(line, `Naziv kategorije je skraćen na ${IMPORT_LIMITS.nameChars} znakova.`);
      st.current = { name: trimmed, items: [], line };
      categories.push(st.current);
    }
    st.last = null;
  };

  const addItem = (name: string, description: string | null, priceCents: number, line: number, priceCount: number) => {
    if (!LETTER.test(name)) return skip(line, "Redak bez naziva stavke je preskočen.");
    if (itemCount >= IMPORT_LIMITS.maxItems) {
      if (!limitHit) warn(line, `Najviše ${IMPORT_LIMITS.maxItems} stavki po jelovniku: ostatak je preskočen.`);
      limitHit = true;
      return skipped++;
    }
    if (!st.current && !limitHit) {
      if (!defaultCategoryWarned) warn(line, `Stavke bez kategorije idu u "${DEFAULT_IMPORT_CATEGORY}". Dodajte redak s nazivom kategorije ispred njih.`);
      defaultCategoryWarned = true;
      openCategory(DEFAULT_IMPORT_CATEGORY, line);
    }
    if (!st.current) return skipped++;
    let n = name;
    if (n.length > IMPORT_LIMITS.nameChars) {
      warn(line, `Naziv stavke je skraćen na ${IMPORT_LIMITS.nameChars} znakova.`);
      n = n.slice(0, IMPORT_LIMITS.nameChars).trim();
    }
    let d = description;
    if (d && d.length > IMPORT_LIMITS.descriptionChars) {
      warn(line, `Opis je skraćen na ${IMPORT_LIMITS.descriptionChars} znakova.`);
      d = d.slice(0, IMPORT_LIMITS.descriptionChars).trim();
    }
    if (priceCount > 1) warn(line, `"${n}": u retku ima više cijena, spremljena je zadnja. Provjerite.`);
    const item: ParsedItem = { name: n, description: d || null, priceCents, line };
    st.current.items.push(item);
    st.last = item;
    itemCount++;
    st.blank = false;
  };

  const lines = input
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .split("\n")
    .map(normalizeDashPrice);
  /** Idući redak ako postoji i nije prazan (inače null): za naziv i cijenu u odvojenim retcima. */
  const adjacentLine = (idx: number): string | null => {
    const t = (lines[idx] ?? "").replace(/[\u00a0\u2007\u202f]/g, " ").trim();
    return t && t.length <= IMPORT_LIMITS.maxLineChars ? t : null;
  };
  const priceOnly = (t: string) => PRICE_ONLY.test(t) && toCents(t) !== null;
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i].replace(/[\u00a0\u2007\u202f]/g, " ");
    let t = raw.trim();
    if (!t) {
      st.blank = true;
      continue;
    }
    if (t.length > IMPORT_LIMITS.maxLineChars) {
      skip(lineNo, `Redak je predug (preko ${IMPORT_LIMITS.maxLineChars} znakova) i preskočen je.`);
      continue;
    }
    if (!LETTER.test(t)) {
      // Samo crte i ukrasi: tiho. Brojevi bez teksta ("12", "5,50"): upozorenje.
      if (/\d/.test(t)) skip(lineNo, `Redak "${t.slice(0, 40)}" nema naziv pa je preskočen.`);
      else skipped++;
      continue;
    }

    // "# Kategorija" je uvijek kategorija.
    if (t.startsWith("#")) {
      const name = cleanHeading(t);
      if (LETTER.test(name)) {
        openCategory(name, lineNo);
        st.blank = true;
      } else skip(lineNo);
      continue;
    }

    // Vodeća crtica/točka: opis prethodne stavke, osim ako je ostatak stavka s cijenom ("- Margherita 8,50").
    const bullet = t.match(/^[-–—•*·]\s+(.+)$/);
    let bulletText: string | null = null;
    if (bullet) {
      bulletText = bullet[1].trim();
      if (!END_PRICE.test(bulletText)) {
        if (st.last) {
          const item: ParsedItem = st.last;
          item.description = collapse(`${item.description ?? ""} ${bulletText}`).slice(0, IMPORT_LIMITS.descriptionChars);
          continue;
        }
        t = bulletText;
      } else {
        t = bulletText;
      }
    }

    // 1) Stavka: redak završava cijenom.
    const end = t.match(END_PRICE);
    if (end && end.index !== undefined) {
      const cents = toCents(end[2]);
      if (cents !== null) {
        const body = t.slice(0, end.index + end[1].length).replace(new RegExp(`[${LEADERS}·•]+$`, "u"), "");
        const { name, description } = splitNameDescription(body);
        const priceCount = (body.match(ANY_PRICE_IN_TEXT) ?? []).length + 1;
        addItem(name, description, cents, lineNo, priceCount);
        continue;
      }
    }

    // 2) Stavka s opisom iza cijene: "Cappuccino 2,00 - s mlijekom".
    const mid = t.match(MID_PRICE);
    if (mid && looksLikeDeliberatePrice(mid[2])) {
      const cents = toCents(mid[2]);
      if (cents !== null && LETTER.test(mid[1])) {
        addItem(collapse(mid[1]), collapse(mid[3]), cents, lineNo, 1);
        continue;
      }
    }

    // 3) Bez cijene: opis prethodne stavke ili naziv kategorije.
    const text = collapse(t);
    const headingByForm = text.endsWith(":") || (isAllCaps(text) && !text.includes(",") && text.split(" ").length <= 4);
    const asDescription = st.last !== null && !st.blank && !headingByForm && descriptionLike(text);
    // Cijena usred retka ili iza koje stoji nešto drugo ("3,50 € (0,3 l)", "2,80 €*") se ne prepoznaje; ne smije se tiho utopiti u opis.
    const priceNotAtEnd = containsPrice(text);
    if (asDescription && st.last) {
      if (priceNotAtEnd) warn(lineNo, `"${text.slice(0, 40)}": izgleda kao stavka, ali cijena nije na kraju retka pa je dodano kao opis prethodne stavke. Provjerite.`);
      const item: ParsedItem = st.last;
      item.description = collapse(`${item.description ?? ""} ${text}`).slice(0, IMPORT_LIMITS.descriptionChars);
      continue;
    }

    // 4) Naziv, a cijena u idućem retku (ili iza jednog retka opisa): stavka, ne kategorija.
    if (!text.endsWith(":")) {
      const next1 = adjacentLine(i + 1);
      const next2 = adjacentLine(i + 2);
      if (next1 !== null && priceOnly(next1)) {
        addItem(text, null, toCents(next1)!, lineNo, 1);
        i += 1;
        continue;
      }
      if (next1 !== null && next2 !== null && LETTER.test(next1) && !END_PRICE.test(next1) && descriptionLike(next1) && priceOnly(next2)) {
        addItem(text, collapse(next1), toCents(next2)!, lineNo, 1);
        i += 2;
        continue;
      }
    }

    const name = cleanHeading(text);
    if (!LETTER.test(name)) {
      skip(lineNo);
      continue;
    }
    if (priceNotAtEnd) warn(lineNo, `"${text.slice(0, 40)}": izgleda kao stavka, ali cijena nije na kraju retka pa je uzeto kao naziv kategorije. Provjerite.`);
    openCategory(name, lineNo);
    st.blank = true;
  }

  const kept: ParsedCategory[] = [];
  for (const c of categories) {
    if (c.items.length === 0) warn(c.line, `Kategorija "${c.name}" nema stavki pa je preskočena.`);
    else kept.push(c);
  }
  warnings.sort((a, b) => a.line - b.line);
  return {
    categories: kept,
    warnings,
    stats: { categories: kept.length, items: kept.reduce((n, c) => n + c.items.length, 0), skippedLines: skipped },
  };
}
