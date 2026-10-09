import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/recenzije/utils";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "label inline-flex h-10 min-w-10 items-center justify-center gap-1 border border-border-strong px-3 sm:pointer-fine:h-9";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted">
      <span className="tabular">
        {from}–{to} od {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={cn(btn, "hover:bg-surface-2 hover:text-foreground")} scroll={false}>
            <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Prethodna</span>
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")} aria-disabled>
            <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Prethodna</span>
          </span>
        )}
        <span className="tabular px-1">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={cn(btn, "hover:bg-surface-2 hover:text-foreground")} scroll={false}>
            <span className="hidden sm:inline">Sljedeća</span> <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")} aria-disabled>
            <span className="hidden sm:inline">Sljedeća</span> <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
