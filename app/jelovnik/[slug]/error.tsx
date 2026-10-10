"use client";

import { Kicker } from "@/components/jelovnik/chrome";

/** Greška pri učitavanju (npr. baza nije dostupna): kratka poruka i gumb za ponovni pokušaj. Pojedinosti se gostu ne prikazuju. */
export default function MenuError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="jl-main">
      <div className="jl-wrap jl-center">
        <Kicker>Jelovnik</Kicker>
        <h1 className="jl-title">Jelovnik se trenutno ne može učitati</h1>
        <p className="jl-lead">Pokušajte ponovno za nekoliko trenutaka. Ako se ne riješi, pitajte osoblje da vam pokažu jelovnik.</p>
        <button type="button" className="jl-btn" onClick={reset}>
          Pokušaj ponovno
        </button>
      </div>
    </main>
  );
}
