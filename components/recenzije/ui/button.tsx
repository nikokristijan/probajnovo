import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/recenzije/utils";

/** NOVO gumbi: crni pravokutnik s mono natpisom (kao "ZATRAŽI PONUDU" na probajnovo.com). */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        primary: "bg-foreground text-white hover:bg-accent",
        secondary: "border border-foreground bg-white text-foreground hover:bg-foreground hover:text-white",
        outline: "border border-border-strong bg-white text-foreground hover:border-foreground",
        ghost: "text-muted hover:text-foreground hover:bg-surface-2",
        danger: "bg-danger text-white hover:bg-[#a80f0f]",
        link: "px-0 h-auto text-accent underline underline-offset-4 hover:text-foreground",
      },
      size: {
        // 40px na mobitelu i tabletu (dodir); kompaktnih 32px samo na širokom ekranu s mišem (sm + pointer-fine).
        sm: "h-10 px-3 sm:pointer-fine:h-8",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-[12px]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Prenese stil na jedino dijete (npr. <Link>) umjesto da renderira <button>. */
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, children, disabled, ...props }: ButtonProps) {
  const cls = cn(buttonVariants({ variant, size }), className);
  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, { className: cn(cls, children.props.className) });
  }
  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  );
}

export { buttonVariants };
