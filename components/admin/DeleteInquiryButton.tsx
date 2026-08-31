"use client";

import { deleteInquiryAction } from "@/lib/actions";

export default function DeleteInquiryButton({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={deleteInquiryAction.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Sigurno želiš trajno obrisati upit od "${name}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
      >
        Obriši
      </button>
    </form>
  );
}
