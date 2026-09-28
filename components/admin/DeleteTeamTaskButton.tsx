"use client";

import { deleteTeamTaskAction } from "@/lib/actions";

/** Isti obrazac kao DeleteExpenseButton — potvrda prije nepovratne radnje. */
export default function DeleteTeamTaskButton({ id, title }: { id: number; title: string }) {
  return (
    <form
      action={deleteTeamTaskAction.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Sigurno želiš obrisati zadatak "${title}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50">
        Obriši
      </button>
    </form>
  );
}
