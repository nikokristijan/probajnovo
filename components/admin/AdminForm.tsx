"use client";

import { useActionState, useState } from "react";
import { createAdminAction, type ActionState } from "@/lib/actions";

export default function AdminForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createAdminAction,
    undefined
  );
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email novog admina
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
          className="admin-input"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Lozinka (barem 8 znakova)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="admin-input"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Dodavanje…" : "Dodaj admina"}
      </button>
    </form>
  );
}
