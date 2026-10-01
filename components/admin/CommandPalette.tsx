"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type PaletteItem = {
  id: string;
  label: string;
  /** Dodatne riječi po kojima se stavka nalazi (npr. "kalendar", slug). */
  keywords?: string[];
  href: string;
  group: "Idi na" | "Vikendice" | "Firme" | "Radnje";
  hint?: string;
};

/**
 * Paleta naredbi (plan #22) — Cmd+K / Ctrl+K ili gumb "Traži" u izborniku.
 * Pretraga i tipkovnica iz biblioteke cmdk (pacocoursey/cmdk), a sam prozor
 * je nativni <dialog> kao i ConfirmSubmit, pa radi Esc, fokus i pozadina.
 */
export default function CommandPalette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const open = () => {
    setSearch("");
    dialogRef.current?.showModal();
    // Chrome pri showModal() fokusira sam dialog — fokus izričito na polje.
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialogRef.current?.open) dialogRef.current.close();
        else {
          setSearch("");
          dialogRef.current?.showModal();
          requestAnimationFrame(() => inputRef.current?.focus());
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = ["Idi na", "Vikendice", "Firme", "Radnje"] as const;

  return (
    <>
      <button type="button" onClick={open} className="cmdk-trigger" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span>Traži</span>
        <kbd className="cmdk-kbd">⌘K</kbd>
      </button>
      <dialog
        ref={dialogRef}
        className="cmdk-dialog"
        aria-label="Brza pretraga"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <Command label="Brza pretraga" className="cmdk-root" loop>
          <Command.Input
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder="Upiši vikendicu, firmu ili stranicu…"
            className="cmdk-input"
          />
          <Command.List className="cmdk-list">
            <Command.Empty className="cmdk-empty">Ništa ne odgovara „{search}“.</Command.Empty>
            {groups.map((g) => {
              const list = items.filter((i) => i.group === g);
              if (list.length === 0) return null;
              return (
                <Command.Group key={g} heading={g} className="cmdk-group">
                  {list.map((i) => (
                    <Command.Item
                      key={i.id}
                      value={`${i.label} ${i.id}`}
                      keywords={i.keywords}
                      onSelect={() => {
                        close();
                        router.push(i.href);
                      }}
                      className="cmdk-item"
                    >
                      <span className="truncate">{i.label}</span>
                      {i.hint && <span className="cmdk-hint">{i.hint}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
          <div className="cmdk-footer" aria-hidden="true">
            ↑↓ za odabir · Enter za otvaranje · Esc za zatvaranje
          </div>
        </Command>
      </dialog>
    </>
  );
}
