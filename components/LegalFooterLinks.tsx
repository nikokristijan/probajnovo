import Link from "next/link";

/**
 * Kompaktan red poveznica na pravne stranice — koristi se na dnu
 * samostalnih stranica (izvan homepage OS-shella koji ima svoj PRAVNO blok
 * u STUDIO tabu) da gost koji sleti izravno na npr. /proizvodi/<slug> ili
 * /slova (dijeljen link, tražilica) i dalje može doći do politike
 * privatnosti/uvjeta/povrata/kolačića bez da se vraća na naslovnicu.
 */
export default function LegalFooterLinks() {
  return (
    <div className="novo-legal-footer">
      <Link href="/privatnost">Politika privatnosti</Link>
      <Link href="/uvjeti">Uvjeti korištenja</Link>
      <Link href="/povrat">Politika povrata</Link>
      <Link href="/kolacici">Politika kolačića</Link>
    </div>
  );
}
