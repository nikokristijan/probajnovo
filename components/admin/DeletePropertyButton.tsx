"use client";

import { deletePropertyAction } from "@/lib/actions";

export default function DeletePropertyButton({ id, name }: { id: number; name: string }) {
  return (
        <form
          action={deletePropertyAction.bind(null, id)}
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
    Obriši vikendicu
</button>
</form>
);
}
