import { Footer, Kicker } from "@/components/jelovnik/chrome";

/** Nepoznata ili isključena adresa jelovnika. Mirno, bez krivnje: najčešći uzrok je stari ili krivo ispisan QR kod. */
export default function MenuNotFound() {
  return (
    <>
      <main className="jl-main">
        <div className="jl-wrap jl-center">
          <Kicker>Jelovnik</Kicker>
          <h1 className="jl-title">Ovaj jelovnik trenutno nije dostupan</h1>
          <p className="jl-lead">
            Poveznica je možda zastarjela ili je jelovnik privremeno isključen. Pitajte osoblje da vam pokažu jelovnik ili za novi QR kod.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
