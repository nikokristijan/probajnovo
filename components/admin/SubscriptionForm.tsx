"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { Subscription, Property, Company } from "@/lib/db/schema";

type SubscriptionAction = (
  prevState: ActionState,
  formData: FormData
) => ActionState | Promise<ActionState>;

type SourceOption = { value: string; label: string };

const STATUS_LABELS: Record<string, string> = {
  active: "Aktivna",
  trial: "Probni period",
  paused: "Pauzirana",
  cancelled: "Otkazana",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function encodeSource(source: "property" | "company", id: number): string {
  return `${source}:${id}`;
}

function decodeSource(value: string): { source: "property" | "company"; id: number } {
  const [source, id] = value.split(":");
  return { source: source as "property" | "company", id: Number(id) };
}

/**
 * Forma za novu ILI postojeću pretplatu — isti "kontrolirana polja" princip
 * kao PropertyForm.tsx (React resetira <form> nakon svake server akcije, pa
 * bi defaultValue pristup izbrisao izmjene ako admin ispravlja samo jednu
 * grešku). `properties`/`companies` pune padajući izbornik "koja stranica"
 * (vidi zahtjev: "opcija za odabrati koja je njihova stranica").
 */
export default function SubscriptionForm({
  subscription,
  properties,
  companies,
  action,
  submitLabel,
}: {
  subscription?: Subscription;
  properties: Property[];
  companies: Company[];
  action: SubscriptionAction;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  const [sourceValue, setSourceValue] = useState(
    subscription ? encodeSource(subscription.source as "property" | "company", subscription.sourceId) : ""
  );
  const [monthlyPriceEur, setMonthlyPriceEur] = useState(String(subscription?.monthlyPriceEur ?? 20));
  const [startDate, setStartDate] = useState(subscription?.startDate ?? todayIso());
  const [isTrial, setIsTrial] = useState(subscription?.isTrial ?? true);
  const [trialEndsAt, setTrialEndsAt] = useState(subscription?.trialEndsAt ?? "");
  const [status, setStatus] = useState(subscription?.status ?? "trial");
  const [nextRenewalDate, setNextRenewalDate] = useState(subscription?.nextRenewalDate ?? "");
  const [note, setNote] = useState(subscription?.note ?? "");

  const { source, id } = sourceValue ? decodeSource(sourceValue) : { source: "property" as const, id: 0 };

  const options: SourceOption[] = [
    ...properties.map((p) => ({ value: encodeSource("property", p.id), label: `🏠 ${p.name}` })),
    ...companies.map((c) => ({ value: encodeSource("company", c.id), label: `🏢 ${c.name}` })),
  ];

  return (
    <form action={formAction} className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-3">
      <span className="text-sm font-semibold">
        {subscription ? "Uredi pretplatu" : "Nova pretplata"}
      </span>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="sourceId" value={id || ""} />

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60 sm:col-span-2">
          Vikendica / firma
          <select
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            required
            className="admin-input"
          >
            <option value="" disabled>
              Odaberi…
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Cijena mjesečno (€)
          <input
            name="monthlyPriceEur"
            type="number"
            min={0}
            step={1}
            required
            value={monthlyPriceEur}
            onChange={(e) => setMonthlyPriceEur(e.target.value)}
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Status
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="admin-input"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Datum starta
          <input
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Sljedeća naplata / istek
          <input
            name="nextRenewalDate"
            type="date"
            required
            value={nextRenewalDate}
            onChange={(e) => setNextRenewalDate(e.target.value)}
            className="admin-input"
          />
        </label>

        <label className="flex items-center gap-2 text-xs font-medium text-black/60 sm:col-span-2">
          <input
            type="checkbox"
            name="isTrial"
            checked={isTrial}
            onChange={(e) => setIsTrial(e.target.checked)}
            className="w-4 h-4"
          />
          Besplatni probni period
        </label>

        {isTrial && (
          <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
            Probni period završava
            <input
              name="trialEndsAt"
              type="date"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className="admin-input"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs font-medium text-black/60 sm:col-span-2">
          Napomena (opcionalno)
          <input name="note" value={note} onChange={(e) => setNote(e.target.value)} className="admin-input" />
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Spremljeno.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
      >
        {pending ? "Spremanje…" : submitLabel}
      </button>
    </form>
  );
}
