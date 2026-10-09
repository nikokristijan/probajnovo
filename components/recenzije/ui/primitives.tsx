import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/recenzije/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 border border-border bg-surface", className)} {...props} />;
}

/** Naslov kartice u NOVO stilu: narančasti kvadratić + mono oznaka velikim slovima. */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="label flex items-center gap-2 text-foreground">
          <span className="size-1.5 shrink-0 bg-orange" aria-hidden />
          {title}
        </h2>
        {description && <p className="mt-1.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

/*
 * Vodoravno pomičan sadržaj (široke tablice na mobitelu) sa sjenom na rubu koji još ima sadržaja,
 * pa se vidi da se tablica može povući. Čisti CSS: "local" pozadine putuju sa sadržajem, "scroll" stoje.
 */
const SCROLL_SHADOW =
  "linear-gradient(to right, #fff 30%, rgb(255 255 255 / 0)) 0 0 / 28px 100% no-repeat local," +
  "linear-gradient(to left, #fff 30%, rgb(255 255 255 / 0)) 100% 0 / 28px 100% no-repeat local," +
  "linear-gradient(to right, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0)) 0 0 / 10px 100% no-repeat scroll," +
  "linear-gradient(to left, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0)) 100% 0 / 10px 100% no-repeat scroll";

export function ScrollX({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-x-auto overscroll-x-contain", className)} style={{ background: SCROLL_SHADOW, ...style }} {...props} />;
}

/**
 * Proširuje područje dodira malih tekstualnih poveznica na ~41px visine bez ikakve promjene rasporeda
 * (nevidljivi ::before; element mora biti inline-flex/block). Preporuka za dodir je najmanje 40px.
 */
export const hitArea = "relative before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']";

export const inputClass =
  "h-11 w-full border border-border-strong bg-white px-3 text-[15px] text-foreground placeholder:text-subtle transition-colors focus:border-foreground focus:outline-none disabled:bg-surface-2 disabled:opacity-70 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, "h-auto min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        inputClass,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-8",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("label mb-2 block text-muted", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const tones = {
  neutral: "bg-surface-2 text-muted border-border-strong",
  green: "bg-success-soft text-success border-success/30",
  blue: "bg-accent-soft text-accent border-accent/30",
  amber: "bg-orange-soft text-warning border-orange/40",
  red: "bg-danger-soft text-danger border-danger/30",
  violet: "bg-violet-soft text-violet border-violet/30",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase leading-5 tracking-[0.06em]",
        tones[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-surface-3", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center border border-foreground text-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "amber",
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone?: "amber" | "red" | "blue" | "green";
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const t = {
    amber: "border-orange bg-orange-soft text-warning",
    red: "border-danger bg-danger-soft text-danger",
    blue: "border-accent bg-accent-soft text-accent",
    green: "border-success bg-success-soft text-success",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-3 border-l-[3px] p-4 sm:flex-row sm:items-center", t, className)} role="status">
      {Icon && <Icon className="size-5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {children && <div className="mt-0.5 text-[13px] text-foreground/75">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Zaglavlje stranice kao na probajnovo.com: mono oznaka s kvadratićem pa veliki naslov. */
export function PageHeader({
  title,
  kicker,
  description,
  actions,
}: {
  title: string;
  kicker?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker && (
          <p className="label mb-3 flex items-center gap-2 text-muted">
            <span className="size-1.5 bg-orange" aria-hidden />
            {kicker}
          </p>
        )}
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight sm:text-[36px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-border-strong bg-surface-2 font-mono text-[11px] font-medium text-foreground", className)}
      aria-hidden
    >
      {ini}
    </span>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} od 5 zvjezdica`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn("size-3.5", i <= rating ? "fill-star" : "fill-surface-3")} aria-hidden>
          <path d="M10 1.5l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L10 14.8l-5.3 2.9 1.2-5.9L1.4 7.7l6-.7z" />
        </svg>
      ))}
    </span>
  );
}
