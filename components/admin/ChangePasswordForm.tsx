"use client";

import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "@/lib/actions";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          Trenutna lozinka
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="admin-input"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className="text-sm font-medium">
          Nova lozinka (barem 8 znakova)
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="admin-input"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Ponovi novu lozinku
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="admin-input"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Lozinka je promijenjena.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Spremanje…" : "Promijeni lozinku"}
      </button>
    </form>
  );
}
