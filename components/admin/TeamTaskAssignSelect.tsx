"use client";

import { useRef } from "react";
import { assignTeamTaskAction } from "@/lib/actions";

/**
 * Select koji se sam šalje pri promjeni (onChange → requestSubmit) — jedini
 * razlog za "use client" ovdje, ostatak kartice zadatka (app/admin/zadaci)
 * ostaje server-rendered. Vidi assignTeamTaskAction u lib/actions.ts.
 */
export default function TeamTaskAssignSelect({
  taskId,
  currentEmail,
  teamMembers,
}: {
  taskId: number;
  currentEmail: string | null;
  teamMembers: { email: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={assignTeamTaskAction.bind(null, taskId)}>
      <select
        name="assignedToEmail"
        defaultValue={currentEmail ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="neu-input !py-1.5 !text-xs"
        aria-label="Dodijeli zadatak"
      >
        <option value="">Nedodijeljeno</option>
        {teamMembers.map((m) => (
          <option key={m.email} value={m.email}>
            {m.email}
          </option>
        ))}
      </select>
    </form>
  );
}
