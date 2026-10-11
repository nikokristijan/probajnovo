/**
 * "Sistemski proizvodi": ponude koje žive u kodu, a ne u tablici products, ali se ipak prikazuju na popisu
 * proizvoda (/proizvodi i tab PROIZVODI na naslovnici). Vlasnik ne mora ništa upisivati u bazu.
 *
 * Trenutno: NOVO Digitalni jelovnik (stranica /digitalni-jelovnik). Cijena se računa iz lib/hospitality-plans.ts,
 * nikad se ne upisuje ručno. Kartica vodi na /digitalni-jelovnik, a ne na /proizvodi/<slug>.
 *
 * Ako admin kasnije sam napravi proizvod sa slugom "digitalni-jelovnik", njegova kartica ima prednost
 * i sistemska se ne prikazuje (nema duplikata). Sistemski proizvodi nisu u bazi, pa ih admin ne vidi ni ne uređuje,
 * a sitemap.xml ih ne ponavlja (/digitalni-jelovnik je već statična stavka).
 *
 * Čisti modul (bez baze i Reacta), pokriven testovima.
 */
import type { ProductCard } from "@/components/NovoHome";
import { HOSPITALITY_PLANS, formatEur } from "@/lib/hospitality-plans";

/** Motiv kartice bez fotografije (vidi components/novo/SystemTile.tsx). */
export type SystemTileKind = "jelovnik" | "recenzije" | "slova" | "nfc";

/** Rezervirani slug: DB proizvod s ovim slugom zamjenjuje sistemsku karticu jelovnika. */
export const MENU_PRODUCT_SLUG = "digitalni-jelovnik";
/** Adresa ponude. */
export const MENU_PAGE_HREF = "/digitalni-jelovnik";
/** Negativan id se nikad ne poklapa sa serial id-jem iz tablice products. */
export const MENU_PRODUCT_ID = -1;

/** Kako se sistemska kartica prikazuje i kamo vodi (ProductCard.system). */
export type SystemListing = {
  /** Cijela kartica vodi ovdje (npr. /digitalni-jelovnik), ne na /proizvodi/<slug>. */
  href: string;
  tile: SystemTileKind;
  /** Mala oznaka iznad naziva (umjesto kategorije). */
  kicker: string;
  /** Tekst cijene; null = cijena se ne prikazuje. */
  priceText: string | null;
  /** Tekst desno u podnožju kartice. */
  goLabel: string;
};

/** Najniža mjesečna cijena paketa, iz lib/hospitality-plans.ts. */
export function menuCheapestMonthlyEur(): number {
  return Math.min(...HOSPITALITY_PLANS.map((p) => p.priceMonthlyEur));
}

/** "od 25 € / mj", izračunato iz paketa. */
export function menuPriceHint(): string {
  return `od ${formatEur(menuCheapestMonthlyEur())} / mj`;
}

export const MENU_NAME = "NOVO Digitalni jelovnik";
export const MENU_TAGLINE = "Digitalni jelovnik s QR kodom i NFC pločicom za kafiće i restorane. Mi sve postavimo.";

/** Sistemska kartica digitalnog jelovnika (oblik jednak kartici proizvoda iz baze). */
export function menuSystemCard(): ProductCard {
  return {
    id: MENU_PRODUCT_ID,
    name: MENU_NAME,
    tagline: MENU_TAGLINE,
    description: MENU_TAGLINE,
    priceEur: menuCheapestMonthlyEur(),
    images: [],
    features: [],
    slug: null,
    featured: false,
    category: null,
    system: {
      href: MENU_PAGE_HREF,
      tile: "jelovnik",
      kicker: "USLUGA",
      priceText: menuPriceHint(),
      goLabel: "SAZNAJ VIŠE →",
    },
  };
}

/**
 * Spaja sistemske kartice s objavljenim proizvodima iz baze. Sistemska kartica ide na početak
 * (NovoHome zatim stabilno stavlja istaknute proizvode ispred, pa je jelovnik prvi ili odmah iza njih),
 * osim ako baza već ima proizvod sa slugom "digitalni-jelovnik": tada se ništa ne dodaje.
 * Ulazni niz se ne mijenja.
 */
export function mergeSystemProducts(dbCards: readonly ProductCard[]): ProductCard[] {
  const menuInDb = dbCards.some((c) => c.slug === MENU_PRODUCT_SLUG);
  return menuInDb ? [...dbCards] : [menuSystemCard(), ...dbCards];
}
