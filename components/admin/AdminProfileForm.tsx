"use client";

import { useActionState } from "react";
import { updateAdminProfileAction, type ActionState } from "@/lib/actions";

const BIRTHDAY_MONTHS = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];

/**
 * Uređivanje vlastitog Portal profila (Faza 3, "svaki admin da ima svoj
 * profil") — SAMO za vlastiti email (provjereno i u pozivatelju stranice i
 * ponovno u samoj server akciji preko requireAdmin()). Sve prazno = koristi
 * dio emaila prije @ kao ime (isti fallback kao Ured/chat labelFor).
 *
 * Rođendan (Task #24, "Rođendani" widget na Portal početnoj) — dva odvojena
 * <select> polja (dan/mjesec) umjesto <input type="date"> jer se GODINA
 * namjerno ne traži/pamti (vidi adminUsers.birthday u schema.ts); spajaju
 * se u "MM-DD" tek u updateAdminProfileAction.
 */
export default function AdminProfileForm({
  initialDisplayName,
  initialJobTitle,
  initialBio,
  initialBirthday,
}: {
  initialDisplayName: string;
  initialJobTitle: string;
  initialBio: string;
  initialBirthday: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateAdminProfileAction, undefined);
  const [bMonth, bDay] = /^\d{2}-\d{2}$/.test(initialBirthday) ? initialBirthday.split("-") : ["", ""];

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
      <div className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--neu-ink-faint)" }}>
        Rođendan <span className="font-normal normal-case">(bez godine — samo dan i mjesec)</span>
        <div className="flex gap-2">
          <select name="birthdayDay" defaultValue={bDay} className="neu-input" style={{ flex: "0 0 90px" }}>
            <option value="">Dan</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
            ))}
          </select>
          <select name="birthdayMonth" defaultValue={bMonth} className="neu-input" style={{ flex: 1 }}>
            <option value="">Mjesec</option>
            {BIRTHDAY_MONTHS.map((name, i) => (
              <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
            ))}
          </select>
        </div>
      </div>
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
