"use client";

import { useActionState } from "react";
import { createTeamTaskAction, type ActionState } from "@/lib/actions";

/**
 * Forma za novi tim zadatak (app/admin/zadaci) — vidi lib/actions.ts
 * createTeamTaskAction. "Poveži s klijentom" je JEDAN select (umjesto dva
 * neovisna polja za vikendicu/firmu) da nikad ne mogu oba biti postavljena
 * odjednom — vrijednost je "property:<id>" ili "company:<id>", parsira se
 * u actionu.
 */
export default function TeamTaskForm({
  teamMembers,
  properties,
  companies,
}: {
  teamMembers: { email: string }[];
  properties: { id: number; name: string }[];
  companies: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTeamTaskAction, undefined);

  return (
    <form action={action} className="neu-card p-5 flex flex-col gap-3">
      <span className="text-sm font-semibold">Novi zadatak</span>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
          Naslov
          <input name="title" required maxLength={200} className="neu-input" placeholder="npr. Obnovi pretplatu" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
          Prioritet
          <select name="priority" className="neu-input" defaultValue="normal">
            <option value="low">Nizak</option>
            <option value="normal">Normalan</option>
            <option value="high">Visok</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
        Opis (opcionalno)
        <textarea name="description" rows={2} maxLength={2000} className="neu-input" placeholder="Detalji zadatka…" />
      </label>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
          Dodijeli
          <select name="assignedToEmail" className="neu-input" defaultValue="">
            <option value="">Nedodijeljeno</option>
            {teamMembers.map((m) => (
              <option key={m.email} value={m.email}>
                {m.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
          Poveži s klijentom
          <select name="client" className="neu-input" defaultValue="">
            <option value="">Bez klijenta</option>
            {properties.length > 0 && (
              <optgroup label="Vikendice">
                {properties.map((p) => (
                  <option key={`property:${p.id}`} value={`property:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            {companies.length > 0 && (
              <optgroup label="Firme">
                {companies.map((c) => (
                  <option key={`company:${c.id}`} value={`company:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
          Rok (opcionalno)
          <input name="dueDate" type="date" className="neu-input" />
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="neu-btn self-start px-4 py-2 text-sm font-semibold disabled:opacity-50">
        {pending ? "Spremanje…" : "Dodaj zadatak"}
      </button>
    </form>
  );
}
