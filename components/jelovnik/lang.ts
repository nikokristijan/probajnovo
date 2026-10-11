import { TRANS_LANGS, type MenuLang, type TransLang } from "@/lib/recenzije/menu-lang";

/** Jezici javne stranice: hrvatski (osnovni) i prijevodi en, de, it. */
export type Lang = MenuLang;
export const LANGS: readonly Lang[] = ["hr", ...TRANS_LANGS];

export function parseLang(value: unknown): Lang | null {
  return value === "hr" || value === "en" || value === "de" || value === "it" ? value : null;
}

/** Jezici koje gost iz regije čita bez muke: za njih ostaje hrvatski jelovnik. */
const READS_CROATIAN = new Set(["hr", "bs", "sr", "sl", "me", "mk"]);

/**
 * Zadani jezik prema zaglavlju Accept-Language, među jezicima koje jelovnik ima (`available`, hrvatski je uvijek).
 * Prvi jezik s popisa preglednika koji je dostupan (njemački, talijanski) dobiva prednost; hrvatski ostaje ako ga preglednik
 * uopće navodi prije toga (mnogi Hrvati imaju mobitel na engleskom, a hrvatski kao drugi jezik); engleski dobiva gost čiji popis
 * hrvatski ne sadrži, a jelovnik nema njegov jezik (npr. francuski turist), jer mu je engleski bolji od hrvatskog. Bez zaglavlja: hrvatski.
 */
export function langFromAcceptLanguage(header: string | null | undefined, available: readonly Lang[] = ["hr", "en"]): Lang {
  if (!header) return "hr";
  let seen = 0;
  for (const part of header.split(",").slice(0, 16)) {
    const [tag, ...params] = part.trim().split(";");
    const primary = tag.trim().toLowerCase().split("-")[0];
    if (!/^[a-z]{2,3}$/.test(primary)) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const weight = q ? Number.parseFloat(q.slice(2)) : 1;
    if (Number.isFinite(weight) && weight <= 0) continue;
    seen++;
    if (READS_CROATIAN.has(primary)) return "hr";
    if ((primary === "de" || primary === "it") && available.includes(primary)) return primary;
  }
  return seen > 0 && available.includes("en") ? "en" : "hr";
}

/**
 * Jezik prvog prikaza: bez ijednog prijevoda uvijek hrvatski; inače izbor gosta (kolačić) ako taj jezik jelovnik ima, a ako ga nema,
 * jezik preglednika. (`hasEnglish` je stari oblik za jelovnike samo s engleskim.)
 */
export function resolveLang(input: { languages?: readonly TransLang[]; hasEnglish?: boolean; cookie?: string | null; acceptLanguage?: string | null }): Lang {
  const languages: readonly TransLang[] = input.languages ?? (input.hasEnglish ? ["en"] : []);
  if (languages.length === 0) return "hr";
  const available: Lang[] = ["hr", ...languages];
  const saved = parseLang(input.cookie);
  if (saved && available.includes(saved)) return saved;
  return langFromAcceptLanguage(input.acceptLanguage, available);
}

/** Adresa vlastitog jelovnika lokala samo ako je ispravan https (ne javascript:, ne adresa s lozinkom). Vraća normaliziranu adresu ili null. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
