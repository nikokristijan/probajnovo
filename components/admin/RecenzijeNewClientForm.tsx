"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { initialState } from "@/lib/recenzije/action";
import { createClientAction, openWorkspaceAction } from "@/lib/recenzije/actions/novo-admin";

/**
 * "Novi klijent": NOVO tim otvara tvrtku za klijenta koji ništa ne postavlja i nema prijavu.
 * Server radnja sve provjerava ponovno (zod) i radi samo za glavnog admina; ovdje su samo
 * polja i poruke. Nakon uspjeha nudi se odmah "Otvori radni prostor" za postavljanje.
 */

export type PlanOption = { key: string; name: string; priceLabel: string; smsLimit: number };

function SubmitButton({ children, pendingLabel }: { children: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-60">
      {pending ? pendingLabel : children}
    </button>
  );
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={"flex flex-col gap-1 text-xs text-black/60 min-w-0 " + (className ?? "")}>
      {label}
      {children}
      {hint && !error && <span className="text-[11px] text-black/45">{hint}</span>}
      {error && <span className="text-[11px] text-[#b80012]">{error}</span>}
    </label>
  );
}

export default function RecenzijeNewClientForm({ plans, defaultOpen }: { plans: PlanOption[]; defaultOpen: boolean }) {
  const [state, action] = useActionState(createClientAction, initialState);
  const [open, setOpen] = useState(defaultOpen);
  const [freeDays, setFreeDays] = useState("0");
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const free = Number(freeDays) > 0;
  const createdOrgId = state.ok && typeof state.data?.orgId === "string" ? state.data.orgId : null;

  return (
    // Otvorenost je u stanju: nakon prvog klijenta popis više nije prazan, a poruka o uspjehu mora ostati vidljiva.
    <details className="neu-card group" open={open} onToggle={(ev) => setOpen(ev.currentTarget.open)}>
      <summary className="cursor-pointer list-none px-4 py-3.5 flex items-center justify-between gap-3">
        <span className="font-semibold text-sm">Novi klijent</span>
        <span className="text-xs font-semibold text-black/55 group-open:hidden">+ Dodaj</span>
        <span className="text-xs font-semibold text-black/55 hidden group-open:inline">Zatvori</span>
      </summary>

      {createdOrgId && (
        // Zasebna forma (ne gumb unutar forme za dodavanje): "Otvori radni prostor" nosi samo orgId i ne ovisi o tome kako preglednik šalje gumb s formAction.
        <form action={openWorkspaceAction} className="px-4 pb-4">
          <input type="hidden" name="orgId" value={createdOrgId} />
          <div role="status" className="rounded-xl border border-[#0b7a3e]/30 bg-[#0b7a3e]/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm min-w-0 break-words">{state.message}</div>
            <button type="submit" className="text-xs font-semibold px-4 py-2 rounded-full bg-black text-white shrink-0">
              Otvori radni prostor
            </button>
          </div>
        </form>
      )}

      <form action={action} className="px-4 pb-4 flex flex-col gap-5" noValidate>
        {state.error && (
          <div role="alert" className="rounded-xl border border-[#d70015]/30 bg-[#d70015]/5 px-4 py-2.5 text-sm text-[#b80012]">
            {state.error}
          </div>
        )}

        <fieldset className="grid gap-3 sm:grid-cols-2 min-w-0">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-black/40 mb-2">Tvrtka</legend>
          <Field label="Naziv tvrtke *" error={e.name}>
            <input name="name" maxLength={80} autoComplete="off" defaultValue={v.name} className="admin-input text-sm" aria-invalid={!!e.name} />
          </Field>
          <Field label="Djelatnost" error={e.industry}>
            <input name="industry" maxLength={60} autoComplete="off" placeholder="npr. Frizerski salon" defaultValue={v.industry} className="admin-input text-sm" aria-invalid={!!e.industry} />
          </Field>
          <Field label="Telefon tvrtke" error={e.phone} hint="Neobavezno">
            <input name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={v.phone} className="admin-input text-sm" aria-invalid={!!e.phone} />
          </Field>
          <Field label="Google link za recenzije" error={e.googleReviewUrl} hint="Može i kasnije u radnom prostoru. Bez njega se ne može slati." className="sm:col-span-2">
            <input
              name="googleReviewUrl"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://g.page/r/…"
              defaultValue={v.googleReviewUrl}
              className="admin-input text-sm"
              aria-invalid={!!e.googleReviewUrl}
            />
          </Field>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2 min-w-0">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-black/40 mb-2">Kontakt (na ovaj email ide tjedni izvještaj)</legend>
          <Field label="Ime i prezime *" error={e.contactName}>
            <input name="contactName" maxLength={80} autoComplete="off" defaultValue={v.contactName} className="admin-input text-sm" aria-invalid={!!e.contactName} />
          </Field>
          <Field label="Email *" error={e.contactEmail}>
            <input name="contactEmail" type="email" inputMode="email" autoComplete="off" defaultValue={v.contactEmail} className="admin-input text-sm" aria-invalid={!!e.contactEmail} />
          </Field>
          <Field label="Telefon" error={e.contactPhone} hint="Neobavezno">
            <input name="contactPhone" type="tel" inputMode="tel" autoComplete="off" defaultValue={v.contactPhone} className="admin-input text-sm" aria-invalid={!!e.contactPhone} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-3 min-w-0">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-black/40 mb-2">Paket</legend>
          <Field label="Paket *" error={e.planKey}>
            <select name="planKey" defaultValue={v.planKey ?? plans[0]?.key} className="admin-input text-sm" aria-invalid={!!e.planKey}>
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} · {p.priceLabel} · {p.smsLimit} SMS
                </option>
              ))}
            </select>
          </Field>
          <Field label="Besplatno razdoblje (dana)" error={e.freeDays} hint="0 = bez besplatnog razdoblja">
            <input
              name="freeDays"
              type="number"
              inputMode="numeric"
              min={0}
              max={90}
              value={freeDays}
              onChange={(ev) => setFreeDays(ev.target.value)}
              className="admin-input text-sm"
              aria-invalid={!!e.freeDays}
            />
          </Field>
          <Field label="Plaćeni mjeseci" error={e.paidMonths} hint={free ? "Ne računa se uz besplatno razdoblje" : "Računa se od danas"}>
            <select name="paidMonths" defaultValue={v.paidMonths ?? "1"} disabled={free} className="admin-input text-sm disabled:opacity-50" aria-invalid={!!e.paidMonths}>
              {[1, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <p className="sm:col-span-3 text-[11px] text-black/50">
            {free
              ? `Klijent dobiva ${freeDays} dana besplatno na odabranom paketu (slanje je ograničeno SMS limitom paketa).`
              : "Paket se aktivira kao plaćen. Za besplatno razdoblje upišite broj dana."}
          </p>
        </fieldset>

        <div>
          <SubmitButton pendingLabel="Dodajem…">Dodaj klijenta</SubmitButton>
        </div>
      </form>
    </details>
  );
}
