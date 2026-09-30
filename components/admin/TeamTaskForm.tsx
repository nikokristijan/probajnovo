"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { createTeamTaskAction, deleteTaskTemplateAction, type ActionState } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

type TaskTemplate = { id: number; title: string; description: string | null; priority: string };

/**
 * Predlošci zadataka (task templates) — klik na chip samo popuni formu ispod
 * (naslov/opis/prioritet preko refova), isti "brzi gumb koji ne šalje formu"
 * obrazac kao QUICK_STATUSES u OfficeStatusForm.tsx. Svaki chip nosi i
 * malu "×" formu za brisanje (odvojenu od glavne forme — <form> se ne smije
 * ugnijezditi u <form>, vidi TeamTaskForm ispod).
 */
function TemplateChips({
  templates,
  onPick,
}: {
  templates: TaskTemplate[];
  onPick: (t: TaskTemplate) => void;
}) {
  if (templates.length === 0) {
    return (
      <p className="text-xs italic" style={{ color: "var(--neu-ink-faint)" }}>
        Još nema predložaka — dodaj zadatak i označi &quot;Spremi kao predložak&quot; da ga sljedeći put brzo popuniš.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {templates.map((t) => (
        <div key={t.id} className="task-template-chip-wrap">
          <button
            type="button"
            className="task-template-chip"
            title={t.description ?? undefined}
            onClick={() => onPick(t)}
          >
            {t.priority === "high" && <span className="task-template-chip-dot" aria-hidden="true" />}
            {t.title}
          </button>
          <ConfirmSubmit
            action={deleteTaskTemplateAction.bind(null, t.id)}
            title={`Obrisati predložak ${t.title}?`}
            description="Postojeći zadaci ostaju, samo predložak nestaje s popisa."
            confirmLabel="Obriši predložak"
            buttonLabel="×"
            buttonClassName="task-template-chip-del"
            buttonAriaLabel={`Obriši predložak ${t.title}`}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Forma za novi tim zadatak (app/admin/zadaci) — vidi lib/actions.ts
 * createTeamTaskAction. "Poveži s klijentom" je JEDAN select (umjesto dva
 * neovisna polja za vikendicu/firmu) da nikad ne mogu oba biti postavljena
 * odjednom — vrijednost je "property:<id>" ili "company:<id>", parsira se
 * u actionu.
 *
 * Task templates (na zahtjev "task templates + polish deadline display") —
 * predlošci se biraju iz chipova iznad forme (TemplateChips), koji preko
 * refova popune naslov/opis/prioritet bez slanja forme; checkbox "Spremi
 * kao predložak" dolje sprema TRENUTNI unos kao novi predložak pri slanju.
 */
export default function TeamTaskForm({
  teamMembers,
  properties,
  companies,
  templates,
}: {
  teamMembers: { email: string }[];
  properties: { id: number; name: string }[];
  companies: { id: number; name: string }[];
  templates: TaskTemplate[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTeamTaskAction, undefined);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const priorityRef = useRef<HTMLSelectElement>(null);

  return (
    <div className="neu-card p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
          Predlošci
        </span>
        <TemplateChips
          templates={templates}
          onPick={(t) => {
            if (titleRef.current) titleRef.current.value = t.title;
            if (descriptionRef.current) descriptionRef.current.value = t.description ?? "";
            if (priorityRef.current) priorityRef.current.value = t.priority;
          }}
        />
      </div>

      <form action={action} className="flex flex-col gap-3">
        <span className="text-sm font-semibold">Novi zadatak</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
            Naslov
            <input ref={titleRef} name="title" required maxLength={200} className="neu-input" placeholder="npr. Obnovi pretplatu" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
            Prioritet
            <select ref={priorityRef} name="priority" className="neu-input" defaultValue="normal">
              <option value="low">Nizak</option>
              <option value="normal">Normalan</option>
              <option value="high">Visok</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--neu-ink-faint)" }}>
          Opis (opcionalno)
          <textarea ref={descriptionRef} name="description" rows={2} maxLength={2000} className="neu-input" placeholder="Detalji zadatka…" />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        <label className="flex items-center gap-2 text-xs font-medium w-fit" style={{ color: "var(--neu-ink-faint)" }}>
          <input type="checkbox" name="saveAsTemplate" className="h-3.5 w-3.5" />
          Spremi kao predložak
        </label>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="neu-btn self-start px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {pending ? "Spremanje…" : "Dodaj zadatak"}
        </button>
      </form>
    </div>
  );
}
