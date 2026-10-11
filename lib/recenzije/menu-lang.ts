/*
 * Jezici javnog jelovnika. Hrvatski je osnovni (polja name, description, intro), a prijevodi su neobavezna polja
 * s nastavkom En / De / It. Čisti kod bez baze i bez server-only: koriste ga poslužitelj, uređivač i javna stranica.
 */

export const TRANS_LANGS = ["en", "de", "it"] as const;
export type TransLang = (typeof TRANS_LANGS)[number];
export type MenuLang = "hr" | TransLang;

export const LANG_NAMES: Record<MenuLang, string> = { hr: "Hrvatski", en: "Engleski", de: "Njemački", it: "Talijanski" };
/** Naziv jezika na engleskom: ide u uputu modelu pri prijevodu. */
export const LANG_ENGLISH_NAMES: Record<TransLang, string> = { en: "English", de: "German", it: "Italian" };

export function isTransLang(v: unknown): v is TransLang {
  return v === "en" || v === "de" || v === "it";
}

/** Sufiks imena polja: nameEn, nameDe, nameIt. */
export const SUFFIX: Record<TransLang, "En" | "De" | "It"> = { en: "En", de: "De", it: "It" };

type Rec = Record<string, unknown>;

/** Prijevod polja za jezik (nameEn / nameDe / nameIt ...) ili null. */
export function pick(obj: Rec, base: "name" | "description" | "intro", lang: TransLang): string | null {
  const v = obj[`${base}${SUFFIX[lang]}`];
  return typeof v === "string" && v.trim() ? v : null;
}

/** Jezici koje ima barem jedan tekst (redoslijed en, de, it). */
export function languagesWithText(has: Record<TransLang, boolean>): TransLang[] {
  return TRANS_LANGS.filter((l) => has[l]);
}

/** Hrvatski ostaje uvijek; ostali samo ako ih jelovnik ima. */
export function switchLanguages(languages: readonly TransLang[]): MenuLang[] {
  return ["hr", ...TRANS_LANGS.filter((l) => languages.includes(l))];
}
