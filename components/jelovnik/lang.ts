export type Lang = "hr" | "en";

export function parseLang(value: unknown): Lang | null {
  return value === "hr" || value === "en" ? value : null;
}

/** Jezici koje gost iz regije čita bez muke: za njih ostaje hrvatski jelovnik. */
const READS_CROATIAN = new Set(["hr", "bs", "sr", "sl", "me", "mk"]);

/**
 * Zadani jezik prema zaglavlju Accept-Language. Hrvatski ostaje ako ga preglednik uopće navodi (mnogi Hrvati imaju
 * mobitel na engleskom, a hrvatski kao drugi jezik); engleski dobiva gost čiji popis jezika hrvatski ne sadrži
 * (npr. njemački ili talijanski turist), jer mu je engleski bolji od hrvatskog. Bez zaglavlja: hrvatski.
 */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
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
  }
  return seen > 0 ? "en" : "hr";
}

/**
 * Jezik prvog prikaza: bez engleskog teksta uvijek hrvatski; inače izbor gosta (kolačić), a ako ga nema, jezik preglednika.
 */
export function resolveLang(input: { hasEnglish: boolean; cookie?: string | null; acceptLanguage?: string | null }): Lang {
  if (!input.hasEnglish) return "hr";
  return parseLang(input.cookie) ?? langFromAcceptLanguage(input.acceptLanguage);
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
