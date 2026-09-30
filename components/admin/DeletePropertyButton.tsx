"use client";

import { deletePropertyAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeletePropertyButton({ id, name }: { id: number; name: string }) {
  return (
    <ConfirmSubmit
      action={deletePropertyAction.bind(null, id)}
      title={`Trajno obrisati vikendicu ${name}?`}
      description="Brišu se i sve njezine rezervacije, troškovi, blokirani dani, upiti i pristupi vlasnika. Pretplata ostaje u financijama kao otkazana."
      confirmLabel="Obriši vikendicu"
      buttonLabel="Obriši vikendicu"
      buttonClassName="text-sm font-semibold text-red-600 border border-red-200 rounded-full px-4 py-2 hover:bg-red-50"
    />
  );
}
