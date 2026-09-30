const MONTH_ABBR = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];

/** Zaokruži gornju granicu osi na "lijep" broj (1, 2, 2.5, 5 × 10^n). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * exp) return step * exp;
  }
  return 10 * exp;
}

/**
 * Stupčasti SVG graf zarade po mjesecu (siječanj → prosinac), bez vanjske
 * biblioteke (vidi app/admin/financije i app/admin/rezervacije).
 *
 * Plan #25: ranije je ovo bila izglađena krivulja — između mjeseci je
 * padala ispod nule i izmišljala vrhove (dvije pretplate od 20 € izgledale
 * su kao dva velika vrha). Mjesečni iznosi su odvojene vrijednosti, pa su
 * stupci pošten prikaz. Os ima 3 vodoravne crte s oznakama, a iznad
 * svakog stupca koji nije 0 piše iznos.
 */
export default function YearlyBarChart({
  data,
  year,
  color = "#ff7f00",
}: {
  data: number[];
  year: number;
  color?: string;
}) {
  const top = niceMax(Math.max(0, ...data));
  const width = 600;
  const left = 44;
  const baseline = 170;
  const plotTop = 22;
  const plotHeight = baseline - plotTop;
  const slot = (width - left) / data.length;
  const barWidth = Math.min(30, slot * 0.62);
  const ticks = [0, top / 2, top];
  const fmt = (n: number) => n.toLocaleString("hr-HR", { maximumFractionDigits: 0 });

  return (
    <div className="border border-black/10 rounded-xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-black/60">
          Zarada po mjesecu — {year}
        </span>
        <span className="text-xs text-black/60 tabular-nums">Ukupno {fmt(data.reduce((a, b) => a + b, 0))} €</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${baseline + 30}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Zarada po mjesecu za ${year}`}
      >
        {ticks.map((t) => {
          const y = baseline - (t / top) * plotHeight;
          return (
            <g key={t}>
              <line x1={left} y1={y} x2={width} y2={y} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="12" fill="rgba(0,0,0,0.6)">
                {fmt(t)}
              </text>
            </g>
          );
        })}

        {data.map((value, i) => {
          const h = (value / top) * plotHeight;
          const x = left + i * slot + (slot - barWidth) / 2;
          const y = baseline - h;
          return (
            <g key={i}>
              <title>{`${MONTH_ABBR[i]} ${year}: ${fmt(value)} €`}</title>
              {value > 0 && (
                <>
                  <rect x={x} y={y} width={barWidth} height={h} rx={4} fill={color} />
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={600}
                    fill="rgba(0,0,0,0.75)"
                  >
                    {fmt(value)}
                  </text>
                </>
              )}
              <text x={left + i * slot + slot / 2} y={baseline + 20} textAnchor="middle" fontSize="12" fill="rgba(0,0,0,0.6)">
                {MONTH_ABBR[i]}
              </text>
            </g>
          );
        })}
        <line x1={left} y1={baseline} x2={width} y2={baseline} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      </svg>
    </div>
  );
}
