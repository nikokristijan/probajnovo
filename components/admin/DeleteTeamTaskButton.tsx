"use client";

import { deleteTeamTaskAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteTeamTaskButton({ id, title }: { id: number; title: string }) {
  return (
    <ConfirmSubmit
      action={deleteTeamTaskAction.bind(null, id)}
      title={`Obrisati zadatak ${title}?`}
      description="Zadatak se briše i ne može se vratiti."
      confirmLabel="Obriši zadatak"
      buttonLabel="Obriši"
      buttonClassName="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
    />
  );
}
