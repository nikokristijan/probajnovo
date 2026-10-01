"use client";

import { useActionState, useState } from "react";
import { updateAdminAccountAction, type SimpleState } from "@/lib/actions-superadmin";

type Option = { id: number; name: string };

export default function EditAdminForm({
  adminId,
  isSuperAdmin,
  initial,
  properties,
  companies,
}: {
  adminId: number;
  isSuperAdmin: boolean;
  initial: { role: "admin" | "owner"; displayName: string; jobTitle: string; propertyIds: number[]; companyIds: number[] };
  properties: Option[];
  companies: Option[];
}) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(
    updateAdminAccountAction.bind(null, adminId),
    undefined
  );
  const [role, setRole] = useState(initial.role);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Ime
          <input name="displayName" defaultValue={initial.displayName} className="admin-input font-normal" placeholder="npr. Ana Horvat" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Uloga u timu
          <input name="jobTitle" defaultValue={initial.jobTitle} className="admin-input font-normal" placeholder="npr. Dizajnerica" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2" disabled={isSuperAdmin}>
        <legend className="text-sm font-medium mb-1">Vrsta računa</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="role" value="admin" checked={role === "admin"} onChange={() => setRole("admin")} className="mt-0.5" />
          <span>
            <span className="font-medium">Puni admin</span>
            <span className="block text-xs text-black/60">Uređuje sve stranice, vidi Portal i upite.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="role" value="owner" checked={role === "owner"} onChange={() => setRole("owner")} className="mt-0.5" />
          <span>
            <span className="font-medium">Vlasnik</span>
            <span className="block text-xs text-black/60">Vidi samo upite, rezervacije i kalendar odabranih stranica.</span>
          </span>
        </label>
      </fieldset>
      {/* Onemogućen fieldset ne šalje svoja polja — uloga glavnog admina ide skriveno. */}
      {isSuperAdmin && <input type="hidden" name="role" value="admin" />}

      {role === "owner" && (
        <div className="flex flex-col gap-3 border border-black/10 rounded-xl p-4 bg-black/[0.02]">
          <span className="text-sm font-medium">Koje stranice vlasnik vidi?</span>
          {properties.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-black/60 uppercase tracking-wide">Vikendice</span>
              {properties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="propertyIds" value={p.id} defaultChecked={initial.propertyIds.includes(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
          {companies.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-black/60 uppercase tracking-wide">Firme</span>
              {companies.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="companyIds" value={c.id} defaultChecked={initial.companyIds.includes(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && !pending && (
        <p className="text-sm text-[#0a6b37] font-medium" role="status">
          Spremljeno.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Spremam…" : "Spremi promjene"}
      </button>
    </form>
  );
}
