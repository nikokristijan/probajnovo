type Point = { x: number; y: number };

/**
 * Ista Catmull-Rom → kubični Bézier izglađena linija kao YearlyBarChart
 * (vidi taj file za obrazloženje), samo generalizirana na proizvoljne
 * oznake umjesto fiksnih 12 mjeseci — vlasnički dashboard prikazuje
 * klizni prozor zadnjih 6 mjeseci (app/admin/page.tsx OwnerDashboard),
 * ne cijelu kalendarsku godinu.
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
 * Generalizirana verzija YearlyBarChart za vlasnički dashboard — isti
 * dependency-free animirani SVG linijski graf (crtanje linije preko
 * pathLength=1 + admin-chart-* klase u globals.css), ali s proizvoljnim
 * `labels`/`data` (npr. zadnjih 6 mjeseci) umjesto fiksne godine. Bez
 * interaktivnosti osim native <title> tooltipa — nije potreban "use client".
 */
export default function OwnerTrendChart({
  title,
  labels,
  data,
  suffix = "",
  color = "#0000c3",
}: {
  title: string;
  labels: string[];
  data: number[];
  suffix?: string;
  color?: string;
}) {
  const max = Math.max(1, ...data);
  const width = 560;
  const baseline = 140;
  const topPadding = 16;
  const plotHeight = baseline - topPadding;
  const slotWidth = width / Math.max(1, data.length);
  const gradientId = `owner-trend-fill-${title.replace(/[^a-zA-Z0-9]/g, "")}-${color.replace("#", "")}`;

  const points: Point[] = data.map((value, i) => ({
    x: i * slotWidth + slotWidth / 2,
    y: baseline - (value / max) * plotHeight,
  }));

  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
      : "";

  const total = data.reduce((a, b) => a + b, 0);

  return (
    <div className="owner-glass owner-glass-grain rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--od-ink-faint)" }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: "var(--od-ink-faint)" }}>
          Ukupno {total}
          {suffix}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${baseline + 24}`}
        className="w-full h-auto"
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <line x1={0} y1={baseline} x2={width} y2={baseline} stroke="var(--od-hairline)" strokeWidth={1} />

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} className="admin-chart-area" />}
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
              {labels[i]}: {data[i]}
              {suffix}
            </title>
            <circle
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill="var(--od-glass-bg-strong)"
              stroke={color}
              strokeWidth={2}
              className="admin-chart-dot"
              style={{ animationDelay: `${0.9 + i * 0.04}s` }}
            />
            <text x={p.x} y={baseline + 18} textAnchor="middle" fontSize="10" fill="var(--od-ink-faint)">
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
