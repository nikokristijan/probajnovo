"use client";

import { Kicker } from "@/components/jelovnik/chrome";
import { useMenuKind } from "@/components/jelovnik/kind-context";
import { menuNoun } from "@/lib/recenzije/menu-noun";

/**
 * Greška pri učitavanju (npr. baza nije dostupna): kratka poruka i gumb za ponovni pokušaj. Pojedinosti se gostu ne prikazuju.
 * Vrsta stranice (jelovnik ili meni) dolazi iz layouta; kad greška nastane u samom layoutu vrsta nije poznata, pa tekst ne imenuje ni jedno ni drugo.
 */
export default function MenuError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const kind = useMenuKind();
  const noun = kind ? menuNoun(kind) : null;
  return (
    <main className="jl-main">
      <div className="jl-wrap jl-center">
        <Kicker>{noun ? noun.Nom : "NOVO"}</Kicker>
        <h1 className="jl-title">{noun ? `${noun.Nom} se trenutno ne može učitati` : "Stranica se trenutno ne može učitati"}</h1>
        <p className="jl-lead">
          Pokušajte ponovno za koji trenutak. Ako i dalje ne ide, osoblje će vam rado {noun ? `pokazati ${noun.acc}` : "pomoći"}.
        </p>
        <button type="button" className="jl-btn" onClick={reset}>
          Pokušaj ponovno
        </button>
      </div>
    </main>
  );
}
