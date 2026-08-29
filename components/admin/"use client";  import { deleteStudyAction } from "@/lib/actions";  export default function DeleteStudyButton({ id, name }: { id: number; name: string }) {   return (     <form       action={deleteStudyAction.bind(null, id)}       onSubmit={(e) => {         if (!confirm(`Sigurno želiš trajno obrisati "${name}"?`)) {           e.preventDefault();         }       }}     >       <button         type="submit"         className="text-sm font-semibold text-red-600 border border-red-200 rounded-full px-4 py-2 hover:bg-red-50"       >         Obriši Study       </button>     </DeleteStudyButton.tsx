"use client";

import { deleteStudyAction } from "@/lib/actions";

export default function DeleteStudyButton({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={deleteStudyAction.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Sigurno želiš trajno obrisati "${name}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-sm font-semibold text-red-600 border border-red-200 rounded-full px-4 py-2 hover:bg-red-50"
      >
        Obriši Study
      </button>
    </form>
  );
}
