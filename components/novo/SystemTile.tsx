import type { SystemTileKind } from "@/lib/system-products";

/**
 * Motiv kartice ponude koja nema fotografiju (digitalni jelovnik, NFC pločica, NOVO Recenzije, prostorna slova).
 * Čisti CSS/SVG u NOVO bojama, bez vanjskih slika. Popunjava roditelja (position: relative) i dekorativan je
 * (aria-hidden): ime ponude uvijek stoji u tekstu kartice. Stilovi su u app/globals.css (.sys-tile).
 */
export default function SystemTile({ kind }: { kind: SystemTileKind }) {
  return (
    <div className={`sys-tile sys-tile--${kind}`} aria-hidden="true">
      {kind === "jelovnik" && <MenuMotif />}
      {kind === "nfc" && <NfcMotif />}
      {kind === "recenzije" && <span className="sys-stars">★★★★★</span>}
      {kind === "slova" && <span className="sys-word">ABC</span>}
    </div>
  );
}

/** NFC valovi: tri luka koja se šire udesno iz pločice (središte 34,60, kut ±40°). */
function NfcArcs({ cx, cy }: { cx: number; cy: number }) {
  const arcs = [14, 24, 34].map((r) => {
    const dx = +(r * 0.766).toFixed(1);
    const dy = +(r * 0.643).toFixed(1);
    return `M ${cx + dx} ${cy - dy} A ${r} ${r} 0 0 1 ${cx + dx} ${cy + dy}`;
  });
  return (
    <g className="sys-arcs" fill="none" strokeWidth="4" strokeLinecap="round">
      {arcs.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/** Mobitel s QR kodom i crtama jelovnika, a lijevo NFC pločica s valovima. */
function MenuMotif() {
  return (
    <svg viewBox="14 4 118 112" preserveAspectRatio="xMidYMid meet" focusable="false">
      <NfcArcs cx={34} cy={60} />
      <circle cx="34" cy="60" r="9" className="sys-plate" />
      <circle cx="34" cy="60" r="3" className="sys-plate-dot" />
      <rect x="74" y="12" width="48" height="96" rx="9" className="sys-phone" />
      <rect x="79" y="20" width="38" height="80" rx="3" fill="#fff" />
      {/* QR: tri tražila i nekoliko modula */}
      <g className="sys-qr">
        <rect x="84" y="26" width="9" height="9" />
        <rect x="103" y="26" width="9" height="9" />
        <rect x="84" y="45" width="9" height="9" />
        <rect x="97" y="40" width="3" height="3" />
        <rect x="103" y="46" width="3" height="3" />
        <rect x="109" y="43" width="3" height="3" />
        <rect x="97" y="49" width="3" height="3" />
      </g>
      <g className="sys-qr-hole" fill="#fff">
        <rect x="86.5" y="28.5" width="4" height="4" />
        <rect x="105.5" y="28.5" width="4" height="4" />
        <rect x="86.5" y="47.5" width="4" height="4" />
      </g>
      {/* crte jelovnika */}
      <g className="sys-lines">
        <rect x="84" y="64" width="20" height="3" rx="1.5" />
        <rect x="107" y="64" width="5" height="3" rx="1.5" />
        <rect x="84" y="73" width="24" height="3" rx="1.5" />
        <rect x="84" y="82" width="17" height="3" rx="1.5" />
        <rect x="107" y="82" width="5" height="3" rx="1.5" />
        <rect x="84" y="91" width="21" height="3" rx="1.5" />
      </g>
    </svg>
  );
}

/** Samo pločica s valovima (kad ponuda upućuje na NFC pločice, a u bazi nema fotografije). */
function NfcMotif() {
  return (
    <svg viewBox="38 18 80 84" preserveAspectRatio="xMidYMid meet" focusable="false">
      <g transform="translate(26 0)">
        <NfcArcs cx={44} cy={60} />
        <circle cx="44" cy="60" r="16" className="sys-plate" />
        <circle cx="44" cy="60" r="5" className="sys-plate-dot" />
      </g>
    </svg>
  );
}
