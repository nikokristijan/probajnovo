"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { initialState } from "@/lib/recenzije/action";
import { updateClientDetailsAction } from "@/lib/recenzije/actions/novo-admin";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/recenzije/business-type";

/**
 * Kontakt klijenta (na njegov email ide tjedni izvještaj), vrsta poslovanja i interna bilješka koju vidi samo
 * NOVO tim. Spremanje je server radnja samo za glavnog admina; poruka se prikazuje ovdje.
 */

export type ClientDetailsDefaults = {
  orgId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  internalNote: string;
  /**
   * Trenutna vrsta poslovanja. null = nije se mogla pročitati: tada se polje uopće ne prikazuje ni ne šalje,
   * pa spremanje kontakta ne može slučajno promijeniti vrstu.
   */
  businessType: BusinessType | null;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-full bg-black text-white text-xs font-semibold px-4 py-2 disabled:opacity-60">
      {pending ? "Spremam…" : "Spremi"}
    </button>
  );
}

export default function RecenzijeClientDetailsForm({ defaults }: { defaults: ClientDetailsDefaults }) {
  const [state, action] = useActionState(updateClientDetailsAction, initialState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3 min-w-0" noValidate>
      <input type="hidden" name="orgId" value={defaults.orgId} />
      <label className="flex flex-col gap-1 text-xs text-black/60 min-w-0">
        Kontakt osoba *
        <input
          name="contactName"
          maxLength={80}
          autoComplete="off"
          defaultValue={v.contactName ?? defaults.contactName}
          className="admin-input text-sm"
          aria-invalid={!!e.contactName}
        />
        {e.contactName && <span className="text-[11px] text-[#b80012]">{e.contactName}</span>}
      </label>
      <label className="flex flex-col gap-1 text-xs text-black/60 min-w-0">
        Email (tjedni izvještaj) *
        <input
          name="contactEmail"
          type="email"
          inputMode="email"
          autoComplete="off"
          defaultValue={v.contactEmail ?? defaults.contactEmail}
          className="admin-input text-sm"
          aria-invalid={!!e.contactEmail}
        />
        {e.contactEmail && <span className="text-[11px] text-[#b80012]">{e.contactEmail}</span>}
      </label>
      <label className="flex flex-col gap-1 text-xs text-black/60 min-w-0">
        Telefon
        <input
          name="contactPhone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          defaultValue={v.contactPhone ?? defaults.contactPhone}
          className="admin-input text-sm"
          aria-invalid={!!e.contactPhone}
        />
        {e.contactPhone && <span className="text-[11px] text-[#b80012]">{e.contactPhone}</span>}
      </label>
      {defaults.businessType && (
        <label className="flex flex-col gap-1 text-xs text-black/60 min-w-0 sm:col-span-3">
          Vrsta poslovanja
          <select
            // Ključ prati spremljenu vrijednost (i vraćenu pri grešci): React nakon svake radnje resetira formu na vrijednost iz
            // trenutka montiranja, pa bi neupravljani <select> inače ostao na staroj vrsti iako je nova spremljena, a idući "Spremi" bi je vratio.
            key={`${defaults.businessType}:${v.businessType ?? ""}`}
            name="businessType"
            defaultValue={v.businessType ?? defaults.businessType}
            className="admin-input text-sm sm:max-w-sm"
            aria-invalid={!!e.businessType}
          >
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-black/45">
            Ugostiteljstvo uključuje digitalni jelovnik s QR kodom i stavku „Jelovnik” u radnom prostoru. Prelazak na „Usluga / obrt” gasi javni jelovnik; unesene stavke ostaju spremljene.
          </span>
          {e.businessType && <span className="text-[11px] text-[#b80012]">{e.businessType}</span>}
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-black/60 min-w-0 sm:col-span-3">
        Interna bilješka (vidi samo NOVO tim)
        <textarea
          name="internalNote"
          rows={3}
          maxLength={2000}
          defaultValue={v.internalNote ?? defaults.internalNote}
          className="admin-input text-sm"
          aria-invalid={!!e.internalNote}
        />
        {e.internalNote && <span className="text-[11px] text-[#b80012]">{e.internalNote}</span>}
      </label>
      <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
        <SaveButton />
        {state.ok && (
          <span role="status" className="text-xs text-[#0b7a3e] font-semibold">
            {state.message}
          </span>
        )}
        {state.error && (
          <span role="alert" className="text-xs text-[#b80012] font-semibold">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
