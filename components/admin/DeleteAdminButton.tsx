"use client";

import { deleteAdminAction } from "@/lib/actions";

export default function DeleteAdminButton({ id, email }: { id: number; email: string }) {
  return (
    <form
      action={deleteAdminAction.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Sigurno želiš maknuti admin pristup za "${email}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
      >
        Ukloni
      </button>
    </form>
  );
}
