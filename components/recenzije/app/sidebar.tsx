"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/recenzije/brand";
import { cn } from "@/lib/recenzije/utils";

/* Izbornik kao na probajnovo.com: mono, velika slova, narančasta točka za aktivnu stavku. */
const MAIN = [
  { href: "/recenzije/pregled", label: "Pregled" },
  { href: "/recenzije/klijenti", label: "Klijenti" },
  { href: "/recenzije/ocjene", label: "Recenzije" },
  { href: "/recenzije/kampanje", label: "Kampanje" },
  { href: "/recenzije/automatizacije", label: "Automatizacije" },
  { href: "/recenzije/poruke", label: "Poruke" },
  { href: "/recenzije/analitika", label: "Analitika" },
  { href: "/recenzije/postavke", label: "Postavke", exact: true },
];
const BOTTOM = [
  { href: "/recenzije/postavke/tvrtka", label: "Profil tvrtke" },
  { href: "/recenzije/postavke/racun", label: "Račun" },
  { href: "/recenzije/postavke/pretplata", label: "Pretplata" },
];

function NavList({ onNavigate, orgName, plan }: { onNavigate?: () => void; orgName: string; plan: string }) {
  const path = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
  const item = (n: { href: string; label: string; exact?: boolean }) => {
    const active = isActive(n.href, n.exact);
    return (
      <li key={n.href}>
        <Link
          href={n.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "label relative flex h-9 items-center px-2 transition-colors",
            active ? "text-foreground" : "text-muted hover:text-foreground"
          )}
        >
          <span className={cn("mr-2 size-1.5 rounded-full", active ? "bg-orange" : "bg-transparent")} aria-hidden />
          {n.label}
        </Link>
      </li>
    );
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo href="/recenzije/pregled" />
      </div>
      <div className="border-b border-border px-5 py-4">
        <p className="truncate text-sm font-bold">{orgName}</p>
        <p className="label mt-1 text-accent">{plan}</p>
      </div>
      <nav aria-label="Glavni izbornik" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">{MAIN.map(item)}</ul>
      </nav>
      <nav aria-label="Račun" className="border-t border-border px-3 py-4">
        <ul className="space-y-0.5">{BOTTOM.map(item)}</ul>
      </nav>
    </div>
  );
}

export function Sidebar({ orgName, plan }: { orgName: string; plan: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-white lg:block">
      <NavList orgName={orgName} plan={plan} />
    </aside>
  );
}

export function MobileNav({ orgName, plan }: { orgName: string; plan: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center text-foreground hover:bg-surface-2 lg:hidden"
        aria-label="Otvori izbornik"
        aria-expanded={open}
      >
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Izbornik">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(300px,85vw)] animate-slide-in border-r border-foreground bg-white">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 grid size-10 place-items-center hover:bg-surface-2"
              aria-label="Zatvori izbornik"
            >
              <X className="size-5" />
            </button>
            <NavList onNavigate={() => setOpen(false)} orgName={orgName} plan={plan} />
          </div>
        </div>
      )}
    </>
  );
}
