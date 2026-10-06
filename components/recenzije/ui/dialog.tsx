"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/recenzije/utils";

/*
 * Lagane zamjene za Radix (Dialog, Switch, Menu) na nativnim elementima:
 * <dialog> daje fokus, Escape i "top layer" besplatno, bez dodatnih paketa.
 */

type DialogCtx = { open: boolean; setOpen: (o: boolean) => void };
const Ctx = React.createContext<DialogCtx | null>(null);

export function Dialog({
  open: controlled,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [inner, setInner] = React.useState(false);
  const open = controlled ?? inner;
  const setOpen = React.useCallback(
    (o: boolean) => {
      if (controlled === undefined) setInner(o);
      onOpenChange?.(o);
    },
    [controlled, onOpenChange]
  );
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function DialogTrigger({ children }: { children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>; asChild?: boolean }) {
  const ctx = React.useContext(Ctx)!;
  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      children.props.onClick?.(e);
      ctx.setOpen(true);
    },
  });
}

export function DialogClose({ children }: { children: React.ReactElement<{ onClick?: () => void }> }) {
  const ctx = React.useContext(Ctx)!;
  return React.cloneElement(children, { onClick: () => ctx.setOpen(false) });
}

export function DialogContent({
  title,
  description,
  children,
  className,
  wide,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const ctx = React.useContext(Ctx)!;
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ctx.open && !d.open) d.showModal();
    if (!ctx.open && d.open) d.close();
  }, [ctx.open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => ctx.open && ctx.setOpen(false)}
      onClick={(e) => {
        // Klik na zatamnjenu pozadinu zatvara prozor.
        if (e.target === e.currentTarget) ctx.setOpen(false);
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto border-t-2 border-foreground bg-white p-0 text-foreground",
        "sm:m-auto sm:border-2",
        wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        className
      )}
    >
      {ctx.open && (
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-lg font-bold">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={() => ctx.setOpen(false)}
              className="grid size-8 shrink-0 place-items-center text-muted hover:bg-surface-2 hover:text-foreground"
              aria-label="Zatvori"
            >
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-foreground bg-foreground" : "border-border-strong bg-surface-3"
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 block size-4 -translate-y-1/2 rounded-full transition-transform",
          checked ? "translate-x-[22px] bg-orange" : "translate-x-[3px] bg-white shadow"
        )}
      />
    </button>
  );
}

type MenuCtx = { open: boolean; setOpen: (o: boolean) => void; rootRef: React.RefObject<HTMLDivElement | null> };
const MCtx = React.createContext<MenuCtx | null>(null);

export function Menu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <MCtx.Provider value={{ open, setOpen, rootRef }}>
      <div ref={rootRef} className="relative inline-block">
        {children}
      </div>
    </MCtx.Provider>
  );
}

export function MenuTrigger({
  children,
  className,
  asChild,
  ...rest
}: { children: React.ReactNode; className?: string; asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(MCtx)!;
  if (asChild && React.isValidElement<{ onClick?: () => void }>(children)) {
    return React.cloneElement(children, { onClick: () => ctx.setOpen(!ctx.open) });
  }
  return (
    <button type="button" aria-haspopup="menu" aria-expanded={ctx.open} className={className} onClick={() => ctx.setOpen(!ctx.open)} {...rest}>
      {children}
    </button>
  );
}

export function MenuContent({ children, align = "end" }: { children: React.ReactNode; align?: "start" | "end" }) {
  const ctx = React.useContext(MCtx)!;
  if (!ctx.open) return null;
  return (
    <div
      role="menu"
      className={cn(
        "absolute top-full z-50 mt-2 min-w-56 border border-foreground bg-white p-1 animate-fade-in",
        align === "end" ? "right-0" : "left-0"
      )}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const ctx = React.useContext(MCtx)!;
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        ctx.setOpen(false);
        onSelect?.();
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50 [&_svg]:size-4",
        danger ? "text-danger" : "text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export const MenuSeparator = () => <div className="my-1 h-px bg-border" />;
