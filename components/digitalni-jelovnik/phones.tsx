/**
 * Crteži mobitela za stranicu /digitalni-jelovnik, samo HTML i CSS (bez slika). Prikazuju izmišljen lokal i izmišljene cijene.
 * Sve unutar okvira je ukras (aria-hidden); tekst za čitače zaslona daje opis uz sliku.
 */

const CATEGORIES = ["Kave", "Pića", "Hrana", "Deserti"];

const COFFEES: { name: string; price: string; desc?: string }[] = [
  { name: "Espresso", price: "1,60 €" },
  { name: "Cappuccino", price: "2,00 €", desc: "Espresso, topli mliječni pjenasti sloj" },
  { name: "Kava s mlijekom", price: "1,90 €" },
  { name: "Domaća limunada", price: "3,50 €", desc: "Limun, med, svježa metvica" },
];

/** Mobitel s gotovim crnim jelovnikom: naziv lokala, kategorije, nekoliko stavki i tri neobavezne tipke. */
export function MenuPhone() {
  return (
    <div className="djp" aria-hidden="true">
      <div className="djp-screen">
        <span className="djp-notch" />
        <p className="djp-url">probajnovo.com/jelovnik/vas-lokal</p>
        <p className="djp-brand">Vaš lokal</p>
        <p className="djp-kicker">Jelovnik</p>
        <ul className="djp-chips">
          {CATEGORIES.map((c, i) => (
            <li key={c} className="djp-chip" data-on={i === 0}>
              {c}
            </li>
          ))}
        </ul>
        <p className="djp-sec">Kave</p>
        <ul className="djp-items">
          {COFFEES.map((it) => (
            <li key={it.name} className="djp-item">
              <div className="djp-item-top">
                <span className="djp-item-name">{it.name}</span>
                <span className="djp-leader" />
                <span className="djp-price">{it.price}</span>
              </div>
              {it.desc && <p className="djp-desc">{it.desc}</p>}
            </li>
          ))}
        </ul>
        <div className="djp-bar">
          <span className="djp-btn">Ocijeni nas</span>
          <span className="djp-btn">Wi-Fi</span>
          <span className="djp-btn">Kontakt</span>
        </div>
      </div>
    </div>
  );
}

/** Mobitel s ulaznim prozorom: broj mobitela je moguć, ali jelovnik se otvara i bez njega. */
export function GatePhone() {
  return (
    <div className="djp" aria-hidden="true">
      <div className="djp-screen djp-screen--short">
        <span className="djp-notch" />
        <div className="djp-backdrop">
          <p className="djp-url">probajnovo.com/jelovnik/vas-lokal</p>
          <p className="djp-brand">Vaš lokal</p>
          <p className="djp-kicker">Jelovnik</p>
          <ul className="djp-chips">
            {CATEGORIES.map((c, i) => (
              <li key={c} className="djp-chip" data-on={i === 0}>
                {c}
              </li>
            ))}
          </ul>
          <p className="djp-sec">Kave</p>
          <ul className="djp-items">
            {COFFEES.slice(0, 3).map((it) => (
              <li key={it.name} className="djp-item">
                <div className="djp-item-top">
                  <span className="djp-item-name">{it.name}</span>
                  <span className="djp-leader" />
                  <span className="djp-price">{it.price}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="djp-gate">
          <p className="djp-brand">Vaš lokal</p>
          <p className="djp-gate-line">Jelovnik otvarate unosom broja mobitela.</p>
          <p className="djp-field">091 234 5678</p>
          <div className="djp-consent">
            <i />
            <span>Pristajem da mi Vaš lokal jednom pošalje SMS s molbom za Google recenziju nakon posjeta.</span>
          </div>
          <p className="djp-go">Otvori jelovnik</p>
          <p className="djp-skip">Pogledaj jelovnik bez unosa broja</p>
        </div>
      </div>
    </div>
  );
}

/** Slikovni prikaz QR koda (nije važeći kod): tri markera u kutovima i nasumično razbacani kvadratići. */
export function QrGlyph({ className }: { className?: string }) {
  const N = 21;
  const cells: [number, number][] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) cells.push([x, y]);
  const finder = (ox: number, oy: number) => (
    <g key={`${ox}-${oy}`}>
      <rect x={ox} y={oy} width="7" height="7" fill="#000" />
      <rect x={ox + 1} y={oy + 1} width="5" height="5" fill="#fff" />
      <rect x={ox + 2} y={oy + 2} width="3" height="3" fill="#000" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${N} ${N}`} className={className} aria-hidden="true" shapeRendering="crispEdges">
      <rect width={N} height={N} fill="#fff" />
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#000" />
      ))}
    </svg>
  );
}
