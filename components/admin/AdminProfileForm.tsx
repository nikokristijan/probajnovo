"use client";

import { useActionState } from "react";
import { updateAdminProfileAction, type ActionState } from "@/lib/actions";

/**
 * Uređivanje vlastitog Portal profila (Faza 3, "svaki admin da ima svoj
 * profil") — SAMO za vlastiti email (provjereno i u pozivatelju stranice i
 * ponovno u samoj server akciji preko requireAdmin()). Sve prazno = koristi
 * dio emaila prije @ kao ime (isti fallback kao Ured/chat labelFor).
 */
export default function AdminProfileForm({
  initialDisplayName,
  initialJobTitle,
  initialBio,
}: {
  initialDisplayName: string;
  initialJobTitle: string;
  initialBio: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateAdminProfileAction, undefined);

  return (
    <form action={action} className="neu-card p-5 flex flex-col gap-3 max-w-md">
      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--neu-ink-faint)" }}>
        Ime za prikaz
        <input name="displayName" defaultValue={initialDisplayName} maxLength={80} placeholder="npr. Ana Horvat" className="neu-input" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--neu-ink-faint)" }}>
        Titula / uloga
        <input name="jobTitle" defaultValue={initialJobTitle} maxLength={80} placeholder="npr. Voditeljica projekata" className="neu-input" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--neu-ink-faint)" }}>
        Bio
        <textarea name="bio" defaultValue={initialBio} maxLength={500} rows={3} placeholder="Par riječi o sebi…" className="neu-input" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="neu-btn px-4 py-2 text-sm font-semibold disabled:opacity-50 w-fit">
          {pending ? "Spremam…" : "Spremi profil"}
        </button>
        {state?.success && <span className="text-xs text-green-600 font-medium">Spremljeno.</span>}
        {state?.error && <span className="text-xs text-red-600 font-medium">{state.error}</span>}
      </div>
    </form>
  );
}
