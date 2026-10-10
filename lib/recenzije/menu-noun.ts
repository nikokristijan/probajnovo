/**
 * Kako se javna stranica lokala zove gostu: "jelovnik" ili "meni" (nr_menus.menu_kind). Lokali koji kažu "meni" ne žele
 * vidjeti "jelovnik" nigdje na stranici, pa svaki javni tekst uzima oblik odavde. Čisto (bez baze i bez server-only):
 * koriste ga i komponente u pregledniku, i poslužitelj (tekst privole), i testovi.
 *
 * Oba imenika su muškog roda, neživo: akuzativ je jednak nominativu ("Otvori jelovnik", "Otvori meni"); genitiv je
 * "jelovnika" / "menija", lokativ "jelovniku" / "meniju".
 */
export type MenuKind = "jelovnik" | "meni";

export const MENU_KINDS: readonly MenuKind[] = ["jelovnik", "meni"];
export const DEFAULT_MENU_KIND: MenuKind = "jelovnik";

/** Oznake za izbornik u postavkama ("Naziv na stranici"). */
export const MENU_KIND_LABELS: Record<MenuKind, string> = { jelovnik: "Jelovnik", meni: "Meni" };

export type MenuNoun = {
  /** jelovnik / meni (nominativ i akuzativ). */
  nom: string;
  acc: string;
  /** jelovnika / menija. */
  gen: string;
  /** jelovniku / meniju. */
  loc: string;
  /** Velikim početnim slovom: Jelovnik / Meni. */
  Nom: string;
  Acc: string;
  Gen: string;
  Loc: string;
};

const FORMS: Record<MenuKind, { nom: string; gen: string; loc: string }> = {
  jelovnik: { nom: "jelovnik", gen: "jelovnika", loc: "jelovniku" },
  meni: { nom: "meni", gen: "menija", loc: "meniju" },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Uvijek ispravna vrsta: sve što nije "meni" (npr. stara ili neispravna vrijednost) je "jelovnik". */
export function parseMenuKind(value: unknown): MenuKind {
  return value === "meni" ? "meni" : "jelovnik";
}

/** Sve padežne forme za vrstu (nepoznata vrijednost = jelovnik). */
export function menuNoun(kind: MenuKind | null | undefined): MenuNoun {
  const f = FORMS[parseMenuKind(kind)];
  return { nom: f.nom, acc: f.nom, gen: f.gen, loc: f.loc, Nom: cap(f.nom), Acc: cap(f.nom), Gen: cap(f.gen), Loc: cap(f.loc) };
}

/** Zadani naslov za vrstu: "Jelovnik" ili "Meni" (isto što je u bazi kao zadani naslov). */
export function defaultMenuTitle(kind: MenuKind | null | undefined): string {
  return menuNoun(kind).Nom;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Naslov koji gost vidi. Spremljeni naslov koji je ZADANI naslov druge vrste ("Jelovnik" kad je odabran "meni" i obrnuto)
 * zamjenjuje se zadanim naslovom odabrane vrste; vlastiti naslov (npr. "Karta pića") ostaje kakav jest.
 */
export function displayMenuTitle(kind: MenuKind | null | undefined, storedTitle: string | null | undefined): string {
  const k = parseMenuKind(kind);
  const title = (storedTitle ?? "").replace(/\s+/g, " ").trim();
  if (!title) return defaultMenuTitle(k);
  const other: MenuKind = k === "jelovnik" ? "meni" : "jelovnik";
  return norm(title) === norm(defaultMenuTitle(other)) ? defaultMenuTitle(k) : title;
}
