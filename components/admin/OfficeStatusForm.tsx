"use client";

import { useActionState, useRef } from "react";
import { updateAdminStatusAction, type ActionState } from "@/lib/actions";

const QUICK_STATUSES = [
  { emoji: "📅", text: "na sastanku" },
  { emoji: "🍽️", text: "na ručku" },
  { emoji: "🎬", text: "montiram video" },
  { emoji: "🏖️", text: "godišnji odmor" },
];

/**
 * Slack-stil "što trenutačno radim" status (Ured v8, na izričit zahtjev
 * "status oblačić iznad lika") — mali inline formular, admin uređuje SAMO
 * svoj vlastiti (renderira se u OfficePresence samo za currentEmail red).
 * Brzi gumbi ispod polja samo popune inpute (ref, ne submit) — admin i dalje
 * mora kliknuti "Spremi", da slučajan klik ne promijeni status bez potvrde.
 * Prazna oba polja + Spremi = briše status.
 */
export default function OfficeStatusForm({
  currentText,
  currentEmoji,
}: {
  currentText: string | null;
  currentEmoji: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateAdminStatusAction, undefined);
  const emojiRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="office-status-form">
      <div className="office-status-row">
        <input
          ref={emojiRef}
          name="statusEmoji"
          defaultValue={currentEmoji ?? ""}
          maxLength={4}
          placeholder="🙂"
          aria-label="Emoji statusa"
          className="neu-input office-status-emoji-input"
        />
        <input
          ref={textRef}
          name="statusText"
          defaultValue={currentText ?? ""}
          maxLength={60}
          placeholder="Tvoj status (npr. na sastanku)…"
          aria-label="Tekst statusa"
          className="neu-input flex-1"
        />
        <button type="submit" disabled={pending} className="neu-btn px-3 py-1.5 text-xs font-semibold shrink-0 disabled:opacity-50">
          {pending ? "…" : "Spremi"}
        </button>
      </div>
      <div className="office-status-quick">
        {QUICK_STATUSES.map((q) => (
          <button
            key={q.text}
            type="button"
            className="office-status-chip"
            onClick={() => {
              if (emojiRef.current) emojiRef.current.value = q.emoji;
              if (textRef.current) textRef.current.value = q.text;
            }}
          >
            {q.emoji} {q.text}
          </button>
        ))}
      </div>
      {state?.error && (
        <p className="text-xs text-red-600" style={{ marginTop: 4 }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
