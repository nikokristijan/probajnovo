const MONTH_ABBR = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];

/**
 * Jednostavan SVG stupčasti graf zarade po mjesecu (12 stupaca, siječanj→
 * prosinac) — bez vanjske biblioteke, čisti SVG (vidi app/admin/prodaja i
 * app/admin/rezervacije). Čisto renderiranje, bez interaktivnosti pa nije
 * potreban "use client".
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
  const max = Math.max(1, ...data);
  const width = 560;
  const height = 160;
  const barGap = 6;
  const barWidth = width / data.length - barGap;

  return (
    <div className="border border-black/10 rounded-xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Zarada po mjesecu — {year}
        </span>
        <span className="text-xs text-black/40">
          Ukupno {data.reduce((a, b) => a + b, 0)} €
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full h-auto" role="img" aria-label={`Zarada po mjesecu za ${year}`}>
        {data.map((value, i) => {
          const barHeight = (value / max) * height;
          const x = i * (barWidth + barGap);
          const y = height - barHeight;
          return (
            <g key={i}>
              <title>
                {MONTH_ABBR[i]} {year}: {value} €
              </title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, value > 0 ? 2 : 0)}
                fill={color}
                rx={3}
                opacity={value > 0 ? 1 : 0.15}
              />
              <text
                x={x + barWidth / 2}
                y={height + 16}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(0,0,0,0.45)"
              >
                {MONTH_ABBR[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
