"use client";

import { deleteNfcTagAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteNfcTagButton({ id, label }: { id: number; label: string }) {
  return (
    <ConfirmSubmit
      action={deleteNfcTagAction.bind(null, id)}
      title={`Trajno obrisati NFC oznaku ${label}?`}
      description="Naljepnica koja vodi na ovu oznaku više neće raditi."
      confirmLabel="Obriši oznaku"
      buttonLabel="Obriši NFC oznaku"
      buttonClassName="text-sm font-semibold text-red-600 border border-red-200 rounded-full px-4 py-2 hover:bg-red-50"
    />
  );
}
