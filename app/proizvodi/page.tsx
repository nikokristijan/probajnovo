import { redirect } from "next/navigation";

/**
 * Homepage (NovoHome.tsx) već ima potpuno funkcionalan "PROIZVODI" tab (isti
 * proizvodi, isti /slova unos) — ova zasebna listing stranica ga je samo
 * duplicirala, pa je spojena natrag u naslovnicu. Stari /proizvodi linkovi
 * (vanjski, spremljeni u pretraživačima i sl.) sad odmah otvore taj tab
 * umjesto da gost završi na POČETNA tabu i mora ručno kliknuti dalje.
 *
 * Pojedine stranice proizvoda (/proizvodi/[slug]) OSTAJU — one imaju svoju
 * SEO metadatu i vlastiti link za dijeljenje, što homepage tab (bez prave
 * rute po proizvodu) ne može zamijeniti.
 */
export default function ProductsListingRedirect() {
  redirect("/?view=products");
}
