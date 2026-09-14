"use client";

import { deleteNfcTagAction } from "@/lib/actions";

export default function DeleteNfcTagButton({ id, label }: { id: number; label: string }) {
  return (
    <form
      action={deleteNfcTagAction.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Sigurno želiš trajno obrisati "${label}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-sm font-semibold text-red-600 border border-red-200 rounded-full px-4 py-2 hover:bg-red-50"
      >
        Obriši NFC oznaku
      </button>
    </form>
  );
}
