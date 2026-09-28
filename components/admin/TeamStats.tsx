import { labelForEmail, type PortalMember } from "@/components/admin/portalUtils";

type Point = { x: number; y: number };

/** Ista Catmull-Rom → kubični Bézier izglađena linija kao OwnerTrendChart/
    YearlyBarChart (vidi te komponente), samo prilagođena --neu-* tokenima
    umjesto --od-* (Portal nije .owner-dash). */
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

function TeamActivityChart({ counts }: { counts: { dateKey: string; count: number }[] }) {
  const max = Math.max(1, ...counts.map((c) => c.count));
  const width = 480;
  const baseline = 120;
  const topPadding = 14;
  const plotHeight = baseline - topPadding;
  const slotWidth = width / Math.max(1, counts.length);

  const points: Point[] = counts.map((c, i) => ({
    x: i * slotWidth + slotWidth / 2,
    y: baseline - (c.count / max) * plotHeight,
  }));
  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 0 ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z` : "";
  const total = counts.reduce((a, b) => a + b.count, 0);

  return (
    <div className="neu-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
          Poruke u timu — zadnjih {counts.length} dana
        </span>
        <span className="text-xs" style={{ color: "var(--neu-ink-faint)" }}>
          Ukupno {total}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${baseline + 20}`} className="w-full h-auto" role="img" aria-label="Aktivnost poruka po danu">
        <defs>
          <linearGradient id="portal-activity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--neu-accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--neu-accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <line x1={0} y1={baseline} x2={width} y2={baseline} stroke="var(--neu-shadow)" strokeWidth={1} />
        {areaPath && <path d={areaPath} fill="url(#portal-activity-fill)" />}
        {linePath && <path d={linePath} fill="none" stroke="var(--neu-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p, i) => (
          <g key={i}>
            <title>
              {counts[i].dateKey}: {counts[i].count}
            </title>
            <circle cx={p.x} cy={p.y} r={3} fill="var(--neu-base)" stroke="var(--neu-accent)" strokeWidth={2} />
            <text x={p.x} y={baseline + 15} textAnchor="middle" fontSize="9.5" fill="var(--neu-ink-faint)">
              {new Date(`${counts[i].dateKey}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC", weekday: "short" })}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: "Za napraviti", color: "#94a3b8" },
  in_progress: { label: "U tijeku", color: "var(--neu-accent)" },
  done: { label: "Gotovo", color: "#16a34a" },
};

function TaskStatusDonut({ statusCounts }: { statusCounts: { status: string; count: number }[] }) {
  const order = ["todo", "in_progress", "done"];
  const byStatus = new Map(statusCounts.map((s) => [s.status, s.count]));
  const data = order.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));
  const total = data.reduce((a, b) => a + b.count, 0);

  const radius = 46;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="neu-card p-5">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
        Zadaci po statusu
      </span>
      <div className="flex items-center gap-5 mt-3 flex-wrap">
        <svg viewBox="0 0 120 120" width={120} height={120} role="img" aria-label="Zadaci po statusu">
          {total === 0 ? (
            <circle cx={60} cy={60} r={radius} fill="none" stroke="var(--neu-shadow)" strokeWidth={strokeWidth} />
          ) : (
            data.map((d) => {
              if (d.count === 0) return null;
              const fraction = d.count / total;
              const dash = fraction * circumference;
              const offset = -(cumulative / total) * circumference;
              cumulative += d.count;
              return (
                <circle
                  key={d.status}
                  cx={60}
                  cy={60}
                  r={radius}
                  fill="none"
                  stroke={STATUS_META[d.status]?.color ?? "#94a3b8"}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 60 60)"
                >
                  <title>
                    {STATUS_META[d.status]?.label}: {d.count}
                  </title>
                </circle>
              );
            })
          )}
          <text x={60} y={64} textAnchor="middle" fontSize="20" fontWeight={700} fill="var(--neu-ink)">
            {total}
          </text>
        </svg>
        <div className="portal-donut-legend">
          {data.map((d) => (
            <div key={d.status} className="portal-donut-legend-item">
              <span className="portal-donut-swatch" style={{ background: STATUS_META[d.status]?.color ?? "#94a3b8" }} />
              {STATUS_META[d.status]?.label} · {d.count}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompletionByAdmin({
  completion,
  roster,
}: {
  completion: { email: string; count: number }[];
  roster: PortalMember[];
}) {
  const max = Math.max(1, ...completion.map((c) => c.count));
  return (
    <div className="neu-card p-5">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
        Dovršeni zadaci po osobi
      </span>
      <div className="flex flex-col gap-2.5 mt-4">
        {completion.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--neu-ink-faint)" }}>
            Još nitko nije završio zadatak.
          </p>
        ) : (
          completion.slice(0, 8).map((c) => (
            <div key={c.email} className="portal-bar-row">
              <span className="portal-bar-row-label">{labelForEmail(c.email, roster)}</span>
              <span className="portal-bar-track">
                <span className="portal-bar-fill" style={{ width: `${(c.count / max) * 100}%` }} />
              </span>
              <span className="portal-bar-row-count">{c.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Statistika taba u Portalu ("Takoder nek bude vise grafova i slicnih
 * stvari") — aktivnost poruka po danu, zadaci po statusu (donut), dovršeni
 * zadaci po osobi (rang-lista). Sve čisti SVG (bez biblioteke), isti
 * dependency-free obrazac kao OwnerTrendChart/YearlyBarChart, samo
 * --neu-* umjesto --od-* tokena jer Portal nije .owner-dash.
 */
export default function TeamStats({
  messageCounts,
  statusCounts,
  completionByAdmin,
  roster,
}: {
  messageCounts: { dateKey: string; count: number }[];
  statusCounts: { status: string; count: number }[];
  completionByAdmin: { email: string; count: number }[];
  roster: PortalMember[];
}) {
  return (
    <div className="portal-stat-grid">
      <TeamActivityChart counts={messageCounts} />
      <TaskStatusDonut statusCounts={statusCounts} />
      <CompletionByAdmin completion={completionByAdmin} roster={roster} />
    </div>
  );
}
