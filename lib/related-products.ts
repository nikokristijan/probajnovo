/**
 * Povezane ponude ("Uz ovo ide i", "Možda vam treba i"): mali, izričit i ručno pisan popis što ide uz što.
 * Nema algoritma preporuka: za svaku vrstu proizvoda piše koje ponude se nude uz nju, a ostalo je pravilo popune.
 *
 * Vrste (ProductKind) se prepoznaju iz sluga, naziva i kategorije proizvoda iz baze (nfc, slova, jelovnik, recenzije).
 * Ciljevi (OfferTarget) se rješavaju ovim redom: objavljeni proizvod iz baze te vrste (ako postoji i nije trenutni),
 * inače sistemska ponuda iz koda (/digitalni-jelovnik, /recenzije, /slova). Tako nema duplikata kad admin
 * kasnije sam napravi proizvod, a nikad se ne prikazuje poveznica na nešto što ne postoji.
 *
 * Tekstovi ne obećavaju ništa što ne postoji: nema popusta na paket, nema umjetne hitnosti, a cijena se prikazuje
 * samo kad je poznata (jelovnik iz lib/hospitality-plans.ts, proizvodi iz baze). NOVO Recenzije nema cijenu na glavnoj stranici.
 *
 * Čisti modul (bez baze i Reacta), pokriven testovima.
 */
import type { ProductCard } from "@/components/NovoHome";
import { eur } from "@/lib/pricing";
import { MENU_PAGE_HREF, MENU_PRODUCT_SLUG, menuPriceHint, type SystemTileKind } from "@/lib/system-products";

/** Što se nudi: nfc = fizička NFC pločica (proizvod iz baze), ostalo su ponude s vlastitim stranicama. */
export type OfferTarget = "nfc" | "jelovnik" | "recenzije" | "slova";
export type ProductKind = OfferTarget | "other";
/** Odakle se gleda: proizvod određene vrste ili stranica /digitalni-jelovnik. */
export type RelatedContext = ProductKind | "page-menu";

export type RelatedOffer = {
  /** Stabilan ključ za React ("p-12" za proizvod iz baze, "sys-jelovnik" za ponudu iz koda). */
  key: string;
  name: string;
  /** Jedna rečenica o koristi. */
  benefit: string;
  href: string;
  /** Prva fotografija proizvoda iz baze; null za ponude iz koda. */
  image: string | null;
  /** Motiv umjesto fotografije; null kad nema ni fotografije ni motiva. */
  tile: SystemTileKind | null;
  kicker: string;
  /** Tekst cijene; null = ne prikazuje se. */
  priceText: string | null;
};

/** Najviše kartica u jednom odjeljku. */
export const RELATED_MAX = 3;
/** Ispod ovoga se odjeljak nadopunjuje ponudama iz koda. */
export const RELATED_MIN = 2;

/** Ručno određen redoslijed ponuda po vrsti proizvoda. */
export const RELATED_TARGETS: Record<RelatedContext, readonly OfferTarget[]> = {
  nfc: ["jelovnik", "recenzije", "slova"],
  slova: ["nfc", "recenzije", "jelovnik"],
  jelovnik: ["nfc", "recenzije", "slova"],
  recenzije: ["jelovnik", "nfc", "slova"],
  other: [],
  "page-menu": ["nfc", "recenzije", "slova"],
};

/** Redoslijed ponuda iz koda kad treba dopuniti odjeljak. */
const TOP_UP_ORDER: readonly OfferTarget[] = ["jelovnik", "recenzije", "slova"];

type SystemTarget = Exclude<OfferTarget, "nfc">;

const SYSTEM_OFFERS: Record<
  SystemTarget,
  { name: string; kicker: string; benefit: string; menuPageBenefit?: string; href: string; tile: SystemTileKind; price: () => string | null }
> = {
  jelovnik: {
    name: "NOVO Digitalni jelovnik",
    kicker: "USLUGA",
    benefit: "Gost prisloni mobitel ili skenira QR kod i vidi jelovnik. Mi sve postavimo.",
    href: MENU_PAGE_HREF,
    tile: "jelovnik",
    price: menuPriceHint,
  },
  recenzije: {
    name: "NOVO Recenzije",
    kicker: "USLUGA",
    benefit: "Više Google recenzija bez vašeg truda: SMS zahtjev nakon posla.",
    menuPageBenefit: "Za obrte i tvrtke, ne samo lokale: SMS zahtjev za Google recenziju nakon svakog posla.",
    href: "/recenzije",
    tile: "recenzije",
    price: () => null,
  },
  slova: {
    name: "Prostorna slova po mjeri",
    kicker: "KONFIGURATOR",
    benefit: "Odaberite font, veličinu i boju, pogledajte uživo i pošaljite upit.",
    menuPageBenefit: "Natpis s imenom lokala: odaberite font, veličinu i boju i pogledajte uživo.",
    href: "/slova",
    tile: "slova",
    price: () => null,
  },
};

/** Kad u bazi nema NFC proizvoda, a stranica ipak želi uputiti na njih. */
const NFC_FALLBACK: RelatedOffer = {
  key: "sys-nfc",
  name: "NFC pločice",
  benefit: "Gost prisloni mobitel i spoji se na Wi-Fi jednim dodirom.",
  href: "/proizvodi",
  image: null,
  tile: "nfc",
  kicker: "PROIZVOD",
  priceText: null,
};

/** Dodatak uz jelovnik koji je istinit samo ako proizvod stvarno spominje Wi-Fi. */
const NFC_MENU_BUNDLE_HINT = "NFC Wi-Fi pločica na stolu uz jelovnik: gost se spoji na Wi-Fi jednim dodirom.";

function haystack(c: Pick<ProductCard, "slug" | "name" | "category">): string {
  return `${c.slug ?? ""} ${c.name} ${c.category ?? ""}`.toLowerCase();
}

/**
 * Vrsta proizvoda iz baze. Redoslijed je važan: "Prostorna slova s NFC pločicom" je slova, a
 * "NFC pločica za Google recenzije" je nfc.
 */
export function productKind(c: Pick<ProductCard, "slug" | "name" | "category">): ProductKind {
  const h = haystack(c);
  if (/\bslov[ao]\b|\bletters?\b/.test(h)) return "slova";
  if (c.slug === MENU_PRODUCT_SLUG || /jelovnik|\bmeni\b/.test(h)) return "jelovnik";
  if (/nfc/.test(h)) return "nfc";
  if (/recenzij|review/.test(h)) return "recenzije";
  return "other";
}

/** Spominje li proizvod Wi-Fi (naziv, slogan, kategorija, značajke). */
function mentionsWifi(c: ProductCard): boolean {
  return /wi-?fi/i.test(`${c.slug ?? ""} ${c.name} ${c.tagline} ${c.category ?? ""} ${c.features.join(" ")}`);
}

function priceTextFor(c: ProductCard): string {
  return c.priceEur != null ? `od ${eur(c.priceEur)}` : "Cijena na upit";
}

function dbOffer(c: ProductCard, benefit?: string): RelatedOffer {
  return {
    key: `p-${c.id}`,
    name: c.name,
    benefit: benefit ?? c.tagline,
    href: `/proizvodi/${c.slug}`,
    image: c.images[0] ?? null,
    tile: null,
    kicker: (c.category?.trim() || "Proizvod").toUpperCase(),
    priceText: priceTextFor(c),
  };
}

function systemOffer(t: SystemTarget, ctx: RelatedContext): RelatedOffer {
  const s = SYSTEM_OFFERS[t];
  return {
    key: `sys-${t}`,
    name: s.name,
    benefit: ctx === "page-menu" && s.menuPageBenefit ? s.menuPageBenefit : s.benefit,
    href: s.href,
    image: null,
    tile: s.tile,
    kicker: ctx === "page-menu" && t === "recenzije" ? "ZA OBRTE I TVRTKE" : s.kicker,
    priceText: s.price(),
  };
}

type Pool = { current: ProductCard | null; linkable: ProductCard[]; ctx: RelatedContext; nfcFallback: boolean };

/** Rješava jedan cilj: proizvod iz baze te vrste (prvi po poretku), inače ponuda iz koda; null ako ne postoji. */
function resolve(t: OfferTarget, pool: Pool): RelatedOffer | null {
  const matches = pool.linkable.filter((c) => productKind(c) === t);
  if (t === "nfc") {
    const best = matches.find(mentionsWifi) ?? matches[0];
    if (best) {
      const hint = pool.ctx === "page-menu" && mentionsWifi(best) ? NFC_MENU_BUNDLE_HINT : undefined;
      return dbOffer(best, hint);
    }
    return pool.nfcFallback ? { ...NFC_FALLBACK } : null;
  }
  // Jelovnik iz baze zamjenjuje onaj iz koda samo kad ima rezervirani slug (isto pravilo kao mergeSystemProducts).
  const dbMatch = t === "jelovnik" ? matches.find((c) => c.slug === MENU_PRODUCT_SLUG) : matches[0];
  if (dbMatch) return dbOffer(dbMatch);
  // Trenutni proizvod je upravo ta vrsta: ne preporučuje se sam sebi.
  if (pool.current && productKind(pool.current) === t) return null;
  return systemOffer(t, pool.ctx);
}

function build(targets: readonly OfferTarget[], pool: Pool): RelatedOffer[] {
  const out: RelatedOffer[] = [];
  const seen = new Set<string>();
  for (const t of targets) {
    const o = resolve(t, pool);
    if (o && !seen.has(o.key)) {
      seen.add(o.key);
      out.push(o);
    }
  }
  return out;
}

/**
 * Povezane ponude na stranici proizvoda /proizvodi/<slug>: prvo ručni popis za vrstu proizvoda, zatim drugi
 * objavljeni proizvodi po poretku (bez trenutnog), a ako je i dalje manje od dva, ponude iz koda.
 * `published` su objavljeni proizvodi iz baze po poretku; proizvodi bez sluga se preskaču (nemaju stranicu).
 */
export function relatedForProduct(current: ProductCard, published: readonly ProductCard[], max = RELATED_MAX): RelatedOffer[] {
  const linkable = published.filter((c) => c.slug && c.id !== current.id);
  const ctx = productKind(current);
  const pool: Pool = { current, linkable, ctx, nfcFallback: false };

  const out = build(RELATED_TARGETS[ctx], pool).slice(0, max);
  const seen = new Set(out.map((o) => o.key));

  for (const c of linkable) {
    if (out.length >= max) break;
    const key = `p-${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(dbOffer(c));
  }

  if (out.length < RELATED_MIN) {
    for (const o of build(TOP_UP_ORDER, pool)) {
      if (out.length >= RELATED_MIN) break;
      if (!seen.has(o.key)) {
        seen.add(o.key);
        out.push(o);
      }
    }
  }
  return out;
}

/**
 * Povezane ponude na /digitalni-jelovnik: NFC pločica (proizvod iz baze, ili poveznica na /proizvodi kad ga nema),
 * NOVO Recenzije za obrte i tvrtke te prostorna slova.
 */
export function relatedForMenuPage(published: readonly ProductCard[]): RelatedOffer[] {
  const linkable = published.filter((c) => c.slug);
  return build(RELATED_TARGETS["page-menu"], { current: null, linkable, ctx: "page-menu", nfcFallback: true });
}
