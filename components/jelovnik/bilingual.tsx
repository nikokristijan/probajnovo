/**
 * Dvojezični tekst: kad postoji drukčiji engleski, ispisuju se oba u zasebnim elementima, a CSS (.jl-menu[data-lang])
 * prikazuje samo odabrani. Tako prebacivanje jezika ne traži novi zahtjev ni ponovno crtanje, a stranica bez JavaScripta
 * ostaje na hrvatskom. Tekst se ispisuje kao obični React tekst (escapeano), nikad kao HTML.
 */
export function Bi({ hr, en }: { hr: string; en?: string | null }) {
  const e = en?.trim();
  if (!e || e === hr) return <>{hr}</>;
  return (
    <>
      <span className="jl-hr" lang="hr">
        {hr}
      </span>
      <span className="jl-en" lang="en">
        {e}
      </span>
    </>
  );
}
