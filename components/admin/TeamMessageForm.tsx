"use client";

import { useActionState } from "react";
import { createTeamMessageAction, type ActionState } from "@/lib/actions";

/**
 * Forma za slanje poruke — dijeli se između glavnog feeda (app/admin/poruke,
 * taskId=null) i komentara ispod zadatka (app/admin/zadaci, taskId
 * postavljen). redirectTo vraća na stranicu s koje je poslano (isti obrazac
 * kao ExpenseForm/ReservationForm — redirect čisti formu za sljedeći unos).
 */
export default function TeamMessageForm({
  taskId = null,
  redirectTo,
  placeholder = "Napiši poruku timu…",
}: {
  taskId?: number | null;
  redirectTo: string;
  placeholder?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createTeamMessageAction.bind(null, taskId, redirectTo),
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          required
          rows={2}
          maxLength={4000}
          placeholder={placeholder}
          className="neu-input flex-1"
        />
        <button type="submit" disabled={pending} className="neu-btn px-4 py-2 text-sm font-semibold shrink-0 disabled:opacity-50">
          {pending ? "Šaljem…" : "Pošalji"}
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
