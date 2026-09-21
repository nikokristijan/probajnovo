import { redirect } from "next/navigation";

/**
 * Prije nije postojao app/en/page.tsx — postojao je samo app/en/[slug]/page.tsx,
 * pa je gola /en adresa (bez slug-a) garantirano vraćala 404 (nema rute koja
 * odgovara). Engleska inačica postoji samo po pojedinoj vikendici
 * (/en/<slug>, vidi app/en/[slug]/page.tsx), nema smisla "opće" engleske
 * naslovnice, pa gost koji dođe na golu /en odmah ide na hrvatsku naslovnicu.
 */
export default function EnglishRootPage() {
  redirect("/");
}
