/**
 * Javna adresa jelovnika: /jelovnik/<slug>. Čisto (bez baze i bez server-only), pa isto pravilo koristi
 * obrazac u sučelju (prije slanja), poslužitelj (prije spremanja) i testovi. Jedinstvenost provjerava baza
 * (services/menus.ts), ovdje je samo oblik i popis rezerviranih riječi.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/**
 * Riječi koje nikad nisu adresa lokala: dijelovi sajta i uobičajeni putovi, da adresa ne zavara gosta
 * (npr. /jelovnik/admin) i da se kasnije može dodati ruta bez sudara.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin", "api", "app", "www", "novo", "probajnovo", "recenzije", "recenzija", "jelovnik", "jelovnici", "menu", "menus", "meni",
  "login", "logout", "prijava", "odjava", "registracija", "signup", "register", "o", "r", "qr", "stol", "stolovi", "table", "tables",
  "demo", "test", "testing", "static", "assets", "public", "_next", "sitemap", "robots", "favicon", "privatnost", "privacy", "uvjeti",
  "terms", "kolacici", "cookies", "kontakt", "contact", "help", "pomoc", "about", "status", "health", "null", "undefined", "new", "edit",
  "nfc", "drop", "povrat", "slova", "proizvodi", "en", "hr", "de", "it",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SlugCheck = { ok: true; slug: string } | { ok: false; error: string };

/** Provjerava oblik adrese: mala slova, brojevi i crtice (3 do 40 znakova), bez rezerviranih riječi. Ne mijenja unos. */
export function validateMenuSlug(raw: string): SlugCheck {
  const slug = raw.trim();
  if (slug.length < SLUG_MIN) return { ok: false, error: `Adresa mora imati barem ${SLUG_MIN} znaka.` };
  if (slug.length > SLUG_MAX) return { ok: false, error: `Adresa smije imati najviše ${SLUG_MAX} znakova.` };
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "Adresa smije imati samo mala slova bez kvačica, brojeve i crtice (bez crtice na početku, na kraju i dvije zaredom)." };
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "Ta je adresa rezervirana. Odaberite drugu." };
  return { ok: true, slug };
}

/** Naziv lokala u adresu: "Konoba Đuro & sin" -> "konoba-duro-sin". Vraća "" kad nema ni jednog slova ili broja. */
export function slugFromName(name: string): string {
  return name
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/**
 * Prijedlog početne adrese iz naziva: dovoljno dug, ne rezerviran. `attempt` 0 je čisti naziv, svaki sljedeći
 * dodaje brojač ("konoba-duro-2"), a služi za zaobilaženje zauzetih adresa (provjerava pozivatelj).
 */
export function suggestMenuSlug(name: string, attempt = 0): string {
  let base = slugFromName(name);
  if (base.length < SLUG_MIN) base = base ? `${base}-lokal` : "lokal";
  if (RESERVED_SLUGS.has(base)) base = `${base}-lokal`;
  if (attempt <= 0) return base.slice(0, SLUG_MAX);
  const suffix = `-${attempt + 1}`;
  return `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
