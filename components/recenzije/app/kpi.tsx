import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/recenzije/utils";

/** KPI kartica: mono oznaka, veliki broj (NOVO plava kad je "pozitivan" pokazatelj). */
export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  delta?: number | null;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const valueTone = { neutral: "text-foreground", green: "text-accent", amber: "text-warning", red: "text-danger" }[tone];
  return (
    <div className="min-w-0 border border-border bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="label text-muted">{label}</p>
        <Icon className="size-4 shrink-0 text-subtle" />
      </div>
      <p className={cn("tabular mt-4 text-[30px] font-bold leading-none tracking-tight sm:text-[34px]", valueTone)}>{value}</p>
      <div className="mt-2.5 flex min-h-5 items-center gap-2 text-xs">
        {delta != null && delta !== 0 && (
          <span className={cn("inline-flex items-center gap-0.5 font-mono font-medium", delta > 0 ? "text-success" : "text-danger")}>
            {delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta)}
          </span>
        )}
        {hint && <span className="truncate text-muted">{hint}</span>}
      </div>
    </div>
  );
}
