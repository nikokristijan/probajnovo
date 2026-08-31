"use client";

import { useActionState, useState } from "react";
import { createAdminAction, type ActionState } from "@/lib/actions";

type Option = { id: number; name: string };

export default function AdminForm({
  properties,
  companies,
}: {
  properties: Option[];
  companies: Option[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createAdminAction,
    undefined
  );
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "owner">("admin");

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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Vrsta računa</span>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="admin"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Puni admin</span>
              <span className="block text-xs text-black/50">
                Isti pristup kao ti — može uređivati sve vikendice, firme, sadržaj agencije itd.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="owner"
              checked={role === "owner"}
              onChange={() => setRole("owner")}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Vlasnik (ograničen pristup)</span>
              <span className="block text-xs text-black/50">
                Vidi samo upite i kalendar dostupnosti za odabrane vikendice/firme ispod — ne
                može uređivati stranicu.
              </span>
            </span>
          </label>
        </div>
      </div>

      {role === "owner" && (
        <div className="flex flex-col gap-3 border border-black/10 rounded-xl p-4 bg-black/[0.02]">
          <span className="text-sm font-medium">Koje vikendice/firme smije gledati?</span>
          {properties.length === 0 && companies.length === 0 ? (
            <p className="text-xs text-black/50">Još nema dodanih vikendica ni firmi.</p>
          ) : (
            <>
              {properties.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-black/50 uppercase tracking-wide">
                    Vikendice
                  </span>
                  {properties.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="propertyIds" value={p.id} />
                      {p.name}
                    </label>
                  ))}
                </div>
              )}
              {companies.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-black/50 uppercase tracking-wide">
                    Firme
                  </span>
                  {companies.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="companyIds" value={c.id} />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

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
