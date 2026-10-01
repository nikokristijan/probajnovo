"use client";

import { useActionState } from "react";
import { acceptInviteAction, type SimpleState } from "@/lib/actions-superadmin";

export default function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(
    acceptInviteAction.bind(null, token),
    undefined
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-password" className="text-sm font-medium">
          Nova lozinka (barem 8 znakova)
        </label>
        <input
          id="invite-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="admin-input"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-confirm" className="text-sm font-medium">
          Ponovi lozinku
        </label>
        <input
          id="invite-confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="admin-input"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
      >
        {pending ? "Spremam…" : "Spremi i uđi"}
      </button>
    </form>
  );
}
