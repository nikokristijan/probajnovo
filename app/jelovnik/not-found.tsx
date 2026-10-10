import { Footer, Kicker } from "@/components/jelovnik/chrome";

/**
 * Nepoznata ili isključena adresa. Mirno, bez krivnje: najčešći uzrok je stari ili krivo ispisan QR kod. Lokal nije poznat
 * (ili je stranica isključena), pa tekst ne govori "jelovnik" ni "meni": to bi za lokal koji kaže drugačije bilo pogrešno.
 */
export default function MenuNotFound() {
  return (
    <>
      <main className="jl-main">
        <div className="jl-wrap jl-center">
          <Kicker>NOVO</Kicker>
          <h1 className="jl-title">Ova stranica trenutno nije dostupna</h1>
          <p className="jl-lead">Poveznica je možda zastarjela ili je stranica privremeno isključena. Pitajte osoblje za novi QR kod.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
