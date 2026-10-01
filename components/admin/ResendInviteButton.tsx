"use client";

import { useActionState } from "react";
import { resendInviteAction, type InviteState } from "@/lib/actions-superadmin";
import InviteResult from "@/components/admin/InviteResult";

export default function ResendInviteButton({ adminId, label }: { adminId: number; label: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    resendInviteAction.bind(null, adminId),
    undefined
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && state.link && <InviteResult email={state.email} link={state.link} emailed={state.emailed} />}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-xs font-semibold px-4 py-2 disabled:opacity-50"
      >
        {pending ? "Šaljem…" : label}
      </button>
    </form>
  );
}
