const MONTH_ABBR = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];

type Point = { x: number; y: number };

/**
 * Catmull-Rom → kubični Bézier izglađen put kroz zadane točke — obični ravni
 * segmenti (polyline) između 12 mjesečnih vrijednosti izgledaju kutasto i
 * "tehnički"; ovo daje glatku, prirodniju liniju kakvu se očekuje od
 * "pravog" grafa zarade (vidi zahtjev: linijski graf, praktičnije i
 * zanimljivije).
 */
function buildSmoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Animirani linijski SVG graf zarade po mjesecu (12 točaka, siječanj→
 * prosinac) — bez vanjske biblioteke, čisti SVG (vidi app/admin/prodaja i
 * app/admin/rezervacije). Zamjena za stari stupčasti prikaz: glatka linija,
 * svjetlija ispuna boje linije ispod nje, i linija se "crta" od početka do
 * kraja svaki put kad se stranica učita (čisti CSS, admin-chart-line u
 * globals.css — pathLength="1" normalizira duljinu puta na 0–1 pa
 * stroke-dashoffset animacija radi bez mjerenja stvarne duljine u JS-u).
 * I dalje bez interaktivnosti (osim native <title> tooltipa), pa nije
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
  const baseline = 140;
  const topPadding = 16;
  const plotHeight = baseline - topPadding;
  const slotWidth = width / data.length;
  const gradientId = `earnings-fill-${year}-${color.replace("#", "")}`;

  const points: Point[] = data.map((value, i) => ({
    x: i * slotWidth + slotWidth / 2,
    y: baseline - (value / max) * plotHeight,
  }));

  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
      : "";

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
      <svg
        viewBox={`0 0 ${width} ${baseline + 24}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Zarada po mjesecu za ${year}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Bazna linija — tanka, samo za vizualni oslonac grafu. */}
        <line x1={0} y1={baseline} x2={width} y2={baseline} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />

        {areaPath && (
          <path d={areaPath} fill={`url(#${gradientId})`} className="admin-chart-area" />
        )}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="admin-chart-line"
          />
        )}

        {points.map((p, i) => (
          <g key={i}>
            <title>
              {MONTH_ABBR[i]} {year}: {data[i]} €
            </title>
            <circle
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill="#fff"
              stroke={color}
              strokeWidth={2}
              className="admin-chart-dot"
              style={{ animationDelay: `${0.9 + i * 0.04}s` }}
            />
            <text
              x={p.x}
              y={baseline + 18}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(0,0,0,0.45)"
            >
              {MONTH_ABBR[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
