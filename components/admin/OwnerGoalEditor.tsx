"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateOwnerGoalAction } from "@/lib/actions";

/**
 * Sitan glass popover za ručnu prilagodbu mjesečnog cilja dana zauzeća —
 * gumb živi unutar OwnerHero.tsx, pored prstena napretka, ALI se sam
 * popover renderira preko React Portala u document.body (ne kao normalno
 * ugniježđeno dijete unutar .owner-hero).
 *
 * Razlog: .owner-hero ima `overflow: hidden` + `isolation: isolate` (da
 * konfeti/pozadinske mrlje ostanu unutar zaobljenih kutova kartice), a
 * gumb za uređivanje cilja sjedi blizu DNA kartice. Popover ugniježđen
 * unutar te kartice ili se reže na rubu (`overflow: hidden`) ili — u
 * kombinaciji s `backdrop-filter` na samom popoveru (owner-glass-strong) —
 * na Safariju zna vizualno "glitchati" (poznati WebKit rub-slučaj kad se
 * overflow:hidden+isolation kombinira s backdrop-filter na potomku), točno
 * ono što je vlasnik prijavio ("zglitcha i ne moze se urediti cilj").
 * Portal u body potpuno izbjegava oba uzroka — popover više nije potomak
 * .owner-hero-a u render stablu, pozicioniran je `fixed` preko koordinata
 * gumba (getBoundingClientRect), pa ne može biti odrezan niti pokupiti taj
 * WebKit glitch. */
export default function OwnerGoalEditor({
  autoGoalDays,
  initialCustomGoalDays,
  onOptimisticChange,
}: {
  autoGoalDays: number;
  initialCustomGoalDays: number | null;
  onOptimisticChange: (goalDays: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [value, setValue] = useState(String(initialCustomGoalDays ?? autoGoalDays));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const POPOVER_WIDTH = 200;

  function openPopover() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Poravnato s desnim rubom gumba (isti vizualni rezultat kao prijašnji
    // `right: 0` unutar relative wrappera), ali klampano unutar viewporta
    // tako da ne izleti s lijeve/desne strane na uskim ekranima.
    const left = Math.min(
      window.innerWidth - POPOVER_WIDTH - 8,
      Math.max(8, rect.right - POPOVER_WIDTH)
    );
    setCoords({ top: rect.bottom + 8, left });
    setOpen(true);
  }

  // NAMJERNO fokusiranje inputa RUČNO (preko rafa + focus({preventScroll}))
  // umjesto autoFocus propa — pravi uzrok bug-a "na tren se pojavi pa
  // odmah nestane": autoFocus na mobitelu (Safari/Chrome) potiče preglednik
  // da SAM odmah scrolla stranicu kako bi fokusirano polje bilo iznad
  // tipkovnice, taj automatski scroll je hvatao naš scroll-close listener
  // ispod i ODMAH zatvarao popover prije nego ga je vlasnik uopće stigao
  // vidjeti. `preventScroll: true` u potpunosti gasi taj automatski scroll
  // (input je već postavljen na dobru poziciju preko getBoundingClientRect
  // u openPopover, ne treba mu dodatni scroll-into-view).
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Zatvori na klik izvan popovera/gumba, Escape, ili STVARNI scroll
  // korisnika (jednostavnije i pouzdanije nego pratiti poziciju gumba
  // tijekom scrolla). Scroll-listener se veže s malim odgodom (obrana u
  // dubinu uz preventScroll gore) — sprječava da bilo kakav preostali
  // layout-pomak odmah po otvaranju (npr. tipkovnica koja se pojavljuje)
  // lažno okine zatvaranje prije nego korisnik uopće stigne nešto učiniti.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleScroll() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    const scrollGuard = window.setTimeout(() => {
      window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    }, 400);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(scrollGuard);
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [open]);

  function save() {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1) return;
    const clamped = Math.min(31, Math.max(1, n));
    onOptimisticChange(clamped);
    startTransition(() => {
      updateOwnerGoalAction(clamped)
        .then(() => router.refresh())
        .catch(() => {});
    });
    setOpen(false);
  }

  function resetToAuto() {
    onOptimisticChange(autoGoalDays);
    setValue(String(autoGoalDays));
    startTransition(() => {
      updateOwnerGoalAction(null)
        .then(() => router.refresh())
        .catch(() => {});
    });
    setOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        className="owner-goal-edit-btn"
        aria-label="Uredi cilj"
        title="Uredi cilj dana zauzeća"
      >
        ✎
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            className="owner-glass owner-glass-strong rounded-xl p-3 flex flex-col gap-2"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              zIndex: 999,
              color: "var(--od-ink)",
            }}
          >
            <label className="text-xs font-semibold" style={{ color: "var(--od-ink-soft)" }}>
              Cilj dana ovaj mjesec
            </label>
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={31}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-lg border px-2.5 py-1.5 text-sm"
              style={{ borderColor: "var(--od-hairline)", background: "transparent", color: "var(--od-ink)" }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="flex-1 rounded-lg bg-[#ff7f00] text-white text-xs font-semibold py-1.5 disabled:opacity-60"
              >
                Spremi
              </button>
              <button
                type="button"
                onClick={resetToAuto}
                disabled={pending}
                className="flex-1 rounded-lg text-xs font-semibold py-1.5 border"
                style={{ borderColor: "var(--od-hairline)", color: "var(--od-ink-soft)" }}
              >
                Auto
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
