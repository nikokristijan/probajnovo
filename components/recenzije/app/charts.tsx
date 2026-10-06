"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/recenzije/utils";

/*
 * Lagani SVG grafikoni (bez vanjske biblioteke) u NOVO stilu: tanka mreža,
 * mono oznake, NOVO plava / narančasta. Svaki grafikon mjeri svoju širinu
 * pa crta u pravim pikselima (tekst se ne razvlači).
 */
const C = {
  grid: "#ececec",
  axis: "#9a9a9a",
  blue: "#0000c3",
  orange: "#ff7f00",
  black: "#000000",
  red: "#d11a1a",
  star: "#f2a100",
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const fmtDay = (v: string) => {
  const [, m, d] = v.split("-");
  return `${Number(d)}.${Number(m)}.`;
};

function niceMax(v: number) {
  if (v <= 4) return Math.max(1, Math.ceil(v));
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}

type Series = { key: string; label: string; color: string };

function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-4">
      {series.map((s) => (
        <span key={s.key} className="label flex items-center gap-1.5 text-muted">
          <span className="size-2" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function BarChart<T extends { bucket: string }>({
  data,
  series,
  height = 240,
  labelPrefix = "",
}: {
  data: (T & Record<string, number | string | null>)[];
  series: Series[];
  height?: number;
  labelPrefix?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 28, r: 6, t: 8, b: 24 };
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const innerW = Math.max(0, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(1, Math.min(14, (band * 0.7) / series.length));
  const ticks = [0, max / 2, max].map((t) => Math.round(t * 10) / 10);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56))));
  const h = hover != null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height: height + 28 }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Grafikon" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => {
            const y = pad.t + innerH - (t / max) * innerH;
            return (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={C.grid} />
                <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize={10} fill={C.axis} fontFamily="var(--font-jetbrains-mono)">
                  {t}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const x0 = pad.l + i * band + (band - barW * series.length) / 2;
            return (
              <g key={d.bucket} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + i * band} y={pad.t} width={band} height={innerH} fill={hover === i ? "#f6f6f6" : "transparent"} />
                {series.map((s, j) => {
                  const v = Number(d[s.key]) || 0;
                  const bh = (v / max) * innerH;
                  return <rect key={s.key} x={x0 + j * barW} y={pad.t + innerH - bh} width={barW - 1} height={bh} fill={s.color} />;
                })}
                {i % labelEvery === 0 && (
                  <text x={pad.l + i * band + band / 2} y={height - 6} textAnchor="middle" fontSize={10} fill={C.axis} fontFamily="var(--font-jetbrains-mono)">
                    {fmtDay(d.bucket)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 border border-foreground bg-white px-2.5 py-1.5 text-xs"
          style={{ left: Math.min(Math.max(0, pad.l + hover * band - 40), Math.max(0, width - 150)) }}
        >
          <p className="label mb-1 text-muted">
            {labelPrefix}
            {fmtDay(h.bucket)}
          </p>
          {series.map((s) => (
            <p key={s.key} className="tabular flex justify-between gap-4">
              <span>{s.label}</span>
              <b>{String(h[s.key] ?? 0)}</b>
            </p>
          ))}
        </div>
      )}
      <Legend series={series} />
    </div>
  );
}

export function ActivityChart({ data }: { data: { bucket: string; sent: number; clicks: number; failed: number }[] }) {
  return (
    <BarChart
      data={data}
      series={[
        { key: "sent", label: "Poslano", color: C.black },
        { key: "clicks", label: "Klikovi", color: C.blue },
        { key: "failed", label: "Neuspjelo", color: C.red },
      ]}
    />
  );
}

export function ReviewsBarChart({ data }: { data: { bucket: string; reviews: number }[] }) {
  return <BarChart data={data} series={[{ key: "reviews", label: "Recenzije", color: C.blue }]} labelPrefix="Tjedan od " />;
}

export function RatingLineChart({ data }: { data: { bucket: string; rating: number | null }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 240;
  const pad = { l: 28, r: 10, t: 10, b: 24 };
  const innerW = Math.max(0, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const y = (r: number) => pad.t + innerH - ((r - 1) / 4) * innerH;
  const pts = data.map((d, i) => (d.rating != null ? { x: pad.l + i * step, y: y(d.rating), d } : null)).filter(Boolean) as {
    x: number;
    y: number;
    d: { bucket: string; rating: number | null };
  }[];
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56))));
  return (
    <div ref={ref} className="w-full" style={{ height: height + 28 }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Prosječna ocjena kroz vrijeme">
          {[1, 2, 3, 4, 5].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={C.grid} />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={C.axis} fontFamily="var(--font-jetbrains-mono)">
                {t}
              </text>
            </g>
          ))}
          {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={C.black} strokeWidth={1.5} />}
          {pts.map((p) => (
            <rect key={p.d.bucket} x={p.x - 3} y={p.y - 3} width={6} height={6} fill={C.orange}>
              <title>{`${fmtDay(p.d.bucket)}: ${p.d.rating}`}</title>
            </rect>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.bucket} x={pad.l + i * step} y={height - 6} textAnchor="middle" fontSize={10} fill={C.axis} fontFamily="var(--font-jetbrains-mono)">
                {fmtDay(d.bucket)}
              </text>
            ) : null
          )}
        </svg>
      )}
      <Legend series={[{ key: "r", label: "Prosječna ocjena po tjednu", color: C.orange }]} />
    </div>
  );
}

/** Horizontalne trake po serviseru / usluzi (poslano, kliknuli, recenzija). */
export function BreakdownBarChart({ data }: { data: { key: string; contacted: number; clicked: number; reviewed: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.contacted));
  const rows: { k: "contacted" | "clicked" | "reviewed"; color: string }[] = [
    { k: "contacted", color: C.black },
    { k: "clicked", color: C.blue },
    { k: "reviewed", color: C.orange },
  ];
  return (
    <div>
      <ul className="space-y-4">
        {data.map((d) => (
          <li key={d.key}>
            <p className="mb-1.5 text-sm font-medium">{d.key}</p>
            <div className="space-y-1">
              {rows.map((r) => (
                <div key={r.k} className="flex items-center gap-2">
                  <div className="h-2 flex-1 bg-surface-2">
                    <div className={cn("h-full")} style={{ width: `${(d[r.k] / max) * 100}%`, background: r.color }} />
                  </div>
                  <span className="tabular w-6 text-right font-mono text-[11px] text-muted">{d[r.k]}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Legend
        series={[
          { key: "a", label: "Poslan zahtjev", color: C.black },
          { key: "b", label: "Kliknuli", color: C.blue },
          { key: "c", label: "Recenzija", color: C.orange },
        ]}
      />
    </div>
  );
}

/** Lijevak: širina trake = udio prve faze. */
export function Funnel({ stages }: { stages: { stage: string; value: number }[] }) {
  const top = stages[0]?.value || 0;
  return (
    <ol className="space-y-4">
      {stages.map((s, i) => {
        const w = top > 0 ? Math.max(2, (s.value / top) * 100) : 0;
        const prev = i > 0 ? stages[i - 1].value : null;
        const step = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.stage}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span>{s.stage}</span>
              <span className="tabular font-mono">
                <b className="text-accent">{s.value}</b>
                {step != null && <span className="ml-2 text-[11px] text-subtle">{step}%</span>}
              </span>
            </div>
            <div className="h-2.5 bg-surface-2">
              <div className="h-full" style={{ width: `${w}%`, background: i === stages.length - 1 ? C.orange : C.black }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
