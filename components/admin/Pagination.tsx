import Link from "next/link";

/**
 * Jednostavna paginacija preko URL parametra `page` (plan #24) — ostali
 * parametri (filtri, pretraga) se čuvaju, pa "Sljedeća" ne gubi filter.
 */
export default function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 flex-wrap text-sm" aria-label="Stranice">
      <span className="text-black/60 tabular-nums">
        {from}–{to} od {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="pager-btn" rel="prev">
            ← Prethodna
          </Link>
        ) : (
          <span className="pager-btn is-disabled" aria-disabled="true">
            ← Prethodna
          </span>
        )}
        <span className="tabular-nums text-black/60">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className="pager-btn" rel="next">
            Sljedeća →
          </Link>
        ) : (
          <span className="pager-btn is-disabled" aria-disabled="true">
            Sljedeća →
          </span>
        )}
      </div>
    </nav>
  );
}
