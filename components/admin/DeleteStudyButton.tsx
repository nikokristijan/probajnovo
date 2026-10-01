"use client";

import { deleteStudyAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteStudyButton({ id, name }: { id: number; name: string }) {
  return (
    <ConfirmSubmit
      action={deleteStudyAction.bind(null, id)}
      title={`Trajno obrisati studiju ${name}?`}
      description="Studija nestaje sa stranice agencije i ne može se vratiti."
      confirmLabel="Obriši studiju"
      buttonLabel="Obriši Study"
      buttonClassName="text-sm font-semibold text-red-600 border border-red-200 rounded-full px-4 py-2 hover:bg-red-50"
    />
  );
}
