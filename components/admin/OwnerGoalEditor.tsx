"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnerGoalAction } from "@/lib/actions";

/**
 * Sitan glass popover za ručnu prilagodbu mjesečnog cilja dana zauzeća —
 * živi unutar OwnerHero.tsx, pored prstena napretka. `onOptimisticChange`
 * odmah pomiče prsten/traku u OwnerHero prije nego server potvrdi (bolji
 * osjećaj odziva), a stvarno spremanje ide preko updateOwnerGoalAction
 * (lib/actions.ts) — čisti klik-handler, nikad dio render puta Server
 * Komponente (isti razlog kao OwnerThemeToggle). router.refresh() nakon
 * spremanja osvježava server-rendered admin.customGoalDays za sljedeći
 * puni prikaz (npr. nakon reloada), bez čega bi optimistički prikaz i
 * stvarno spremljeno stanje mogli s vremenom razići. */
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
  const [value, setValue] = useState(String(initialCustomGoalDays ?? autoGoalDays));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="owner-goal-edit-btn"
        aria-label="Uredi cilj"
        title="Uredi cilj dana zauzeća"
      >
        ✎
      </button>
      {open && (
        <div
          className="owner-glass owner-glass-strong absolute right-0 top-full mt-2 z-20 rounded-xl p-3 flex flex-col gap-2"
          style={{ width: 200, color: "var(--od-ink)" }}
        >
          <label className="text-xs font-semibold" style={{ color: "var(--od-ink-soft)" }}>
            Cilj dana ovaj mjesec
          </label>
          <input
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
        </div>
      )}
    </div>
  );
}
