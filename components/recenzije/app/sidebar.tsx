"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/recenzije/brand";
import { lockPageScroll } from "@/components/recenzije/ui/scroll-lock";
import { cn } from "@/lib/recenzije/utils";

/* Izbornik kao na probajnovo.com: mono, velika slova, narančasta točka za aktivnu stavku. */
const MAIN = [
  { href: "/recenzije/pregled", label: "Pregled" },
  { href: "/recenzije/klijenti", label: "Klijenti" },
  { href: "/recenzije/ocjene", label: "Recenzije" },
  { href: "/recenzije/plakat", label: "QR plakat" },
  { href: "/recenzije/kampanje", label: "Kampanje" },
  { href: "/recenzije/automatizacije", label: "Automatizacije" },
  { href: "/recenzije/poruke", label: "Poruke" },
  { href: "/recenzije/analitika", label: "Analitika" },
  { href: "/recenzije/postavke", label: "Postavke", exact: true },
];
/* Samo za ugostiteljstvo (organizations.is_venue): digitalni jelovnik, odmah ispred QR plakata. */
const MENU_ITEM = { href: "/recenzije/jelovnik", label: "Jelovnik" };
const POSTER_HREF = "/recenzije/plakat";

function mainItems(isVenue: boolean) {
  if (!isVenue) return MAIN;
  const at = MAIN.findIndex((n) => n.href === POSTER_HREF);
  return at === -1 ? [...MAIN, MENU_ITEM] : [...MAIN.slice(0, at), MENU_ITEM, ...MAIN.slice(at)];
}

/* Klijenti nemaju prijavu: "Račun" je samo za stare korisnike s lozinkom, a NOVO tim ga ne vidi. */
const BOTTOM = [{ href: "/recenzije/postavke/pretplata", label: "Paket i razdoblje" }];
const ACCOUNT = { href: "/recenzije/postavke/racun", label: "Račun" };

function NavList({
  onNavigate,
  onClose,
  closeRef,
  orgName,
  plan,
  showAccount,
  isVenue,
}: {
  onNavigate?: () => void;
  /** Samo u mobilnoj ladici: gumb za zatvaranje živi u istom retku kao logo. */
  onClose?: () => void;
  closeRef?: React.Ref<HTMLButtonElement>;
  orgName: string;
  plan: string;
  showAccount: boolean;
  isVenue: boolean;
}) {
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
            // Na dodir (ladica) stavke su 44px visoke; na desktopu ostaju zbijene.
            "label relative flex items-center px-2 transition-colors",
            onClose ? "h-11" : "h-9",
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
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-5">
        <Logo href="/recenzije/pregled" />
        {onClose && (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="-mr-2.5 grid size-11 shrink-0 place-items-center hover:bg-surface-2"
            aria-label="Zatvori izbornik"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
      <div className="shrink-0 border-b border-border px-5 py-4">
        <p className="truncate text-sm font-bold">{orgName}</p>
        <p className="label mt-1 truncate text-accent">{plan}</p>
      </div>
      <nav aria-label="Glavni izbornik" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <ul className="space-y-0.5">{mainItems(isVenue).map(item)}</ul>
      </nav>
      <nav aria-label="Paket i račun" className="shrink-0 border-t border-border px-3 py-4">
        <ul className="space-y-0.5">{(showAccount ? [...BOTTOM, ACCOUNT] : BOTTOM).map(item)}</ul>
      </nav>
    </div>
  );
}

export function Sidebar({
  orgName,
  plan,
  showAccount = false,
  isVenue = false,
}: {
  orgName: string;
  plan: string;
  showAccount?: boolean;
  isVenue?: boolean;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-white lg:block">
      <NavList orgName={orgName} plan={plan} showAccount={showAccount} isVenue={isVenue} />
    </aside>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/*
 * Mobilna ladica. Zašto portal: zaglavlje ima backdrop-blur, a svaki element s backdrop-filterom
 * (kao i transform/filter) postaje "containing block" za position:fixed potomke. Ladica unutar
 * zaglavlja zato nije pokrivala ekran, nego se skupila na visinu zaglavlja (64px) i izrezala.
 * Renderiranjem u .nr korijen (izvan zaglavlja) fixed opet znači "cijeli viewport".
 */
export function MobileNav({
  orgName,
  plan,
  showAccount = false,
  isVenue = false,
}: {
  orgName: string;
  plan: string;
  showAccount?: boolean;
  isVenue?: boolean;
}) {
  const path = usePathname();
  // Ladica je otvorena samo za putanju na kojoj je otvorena: svaka navigacija (i "natrag") je zatvara.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const open = openAt === path && host !== null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpenAt(null), []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    // Zaključaj pomicanje pozadine (bez poskakivanja sadržaja kad nestane klasična traka za pomicanje).
    const unlock = lockPageScroll();
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Fokus ostaje unutar ladice dok je otvorena.
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    // Ako se prozor proširi do desktop izgleda, ladica se skriva (lg:hidden) pa mora i otpustiti zaključani scroll.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = (e: MediaQueryListEvent) => e.matches && close();
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      unlock();
      trigger?.focus({ preventScroll: true });
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          // .nr nosi font, boju i fokus-stilove aplikacije, pa ladica ide u njega, a ne izravno u body.
          setHost(triggerRef.current?.closest<HTMLElement>(".nr") ?? document.body);
          setOpenAt(path);
        }}
        className="-ml-2.5 grid size-11 shrink-0 place-items-center text-foreground hover:bg-surface-2 lg:hidden"
        aria-label="Otvori izbornik"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Menu className="size-5" />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Izbornik">
            <div
              className="absolute inset-0 touch-none bg-black/45 transition-opacity duration-200 starting:opacity-0"
              onClick={close}
              aria-hidden
            />
            <div
              ref={panelRef}
              className="absolute inset-y-0 left-0 h-dvh w-[min(320px,85vw)] animate-slide-in overflow-hidden border-r border-foreground bg-white pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]"
            >
              <NavList
                onNavigate={close}
                onClose={close}
                closeRef={closeRef}
                orgName={orgName}
                plan={plan}
                showAccount={showAccount}
                isVenue={isVenue}
              />
            </div>
          </div>,
          host!
        )}
    </>
  );
}
