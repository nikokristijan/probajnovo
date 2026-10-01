"use client";

import { deleteProductAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteProductButton({ id, name }: { id: number; name: string }) {
  return (
    <ConfirmSubmit
      action={deleteProductAction.bind(null, id)}
      title={`Trajno obrisati proizvod ${name}?`}
      description="Stranica proizvoda prestaje raditi i ne može se vratiti."
      confirmLabel="Obriši proizvod"
      buttonLabel="Obriši proizvod"
      buttonClassName="text-sm font-semibold text-red-600 border border-red-200 rounded-full px-4 py-2 hover:bg-red-50"
    />
  );
}
