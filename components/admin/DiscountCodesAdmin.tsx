"use client";

import { useActionState, useTransition } from "react";
import {
  createDiscountCodeAction,
  deleteDiscountCodeAction,
  toggleDiscountCodeAction,
  updateReferralPercentAction,
  type ActionState,
} from "@/lib/actions";
import { Field } from "./Field";

type CodeRow = {
  id: number;
  code: string;
  percent: number;
  active: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  note: string | null;
  referrerName: string | null;
  referrerEmail: string | null;
};

function statusOf(c: CodeRow, today: string): { label: string; tone: string } {
  if (!c.active) return { label: "Isključen", tone: "bg-black/10 text-black/60" };
  if (c.expiresAt && c.expiresAt < today) return { label: "Istekao", tone: "bg-amber-100 text-amber-800" };
  if (c.maxUses != null && c.uses >= c.maxUses) return { label: "Potrošen", tone: "bg-amber-100 text-amber-800" };
  return { label: "Aktivan", tone: "bg-green-100 text-green-800" };
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${Number(day)}. ${Number(m)}. ${y}.`;
}

export default function DiscountCodesAdmin({
  codes,
  referralPercent,
  today,
}: {
  codes: CodeRow[];
  referralPercent: number;
  today: string;
}) {
  const [createState, createAction, creating] = useActionState<ActionState, FormData>(createDiscountCodeAction, undefined);
  const [refState, refAction, savingRef] = useActionState<ActionState, FormData>(updateReferralPercentAction, undefined);
  const [busy, startTransition] = useTransition();

  const manual = codes.filter((c) => !c.referrerEmail);
  const referrals = codes.filter((c) => c.referrerEmail);

  return (
    <>
      <section className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Novi kod za popust</h2>
        <form action={createAction} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <Field label="Kod (npr. LJETO10)">
            <input name="code" required maxLength={32} className="admin-input uppercase" placeholder="LJETO10" />
          </Field>
          <Field label="Popust (%)">
            <input name="percent" type="number" min={1} max={90} required className="admin-input" placeholder="10" />
          </Field>
          <Field label="Vrijedi do (opc.)">
            <input name="expiresAt" type="date" className="admin-input" />
          </Field>
          <Field label="Najviše korištenja (opc.)">
            <input name="maxUses" type="number" min={1} className="admin-input" placeholder="∞" />
          </Field>
          <Field label="Bilješka (opc.)">
            <input name="note" maxLength={200} className="admin-input" placeholder="npr. Instagram objava" />
          </Field>
          <button
            type="submit"
            disabled={creating}
            className="col-span-2 sm:col-span-5 self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
          >
            {creating ? "Spremanje…" : "Dodaj kod"}
          </button>
        </form>
        {createState?.error && <p className="text-sm text-red-600">{createState.error}</p>}
        {createState?.success && <p className="text-sm text-green-700">Kod je dodan.</p>}
        <p className="text-xs text-black/50">
          Kupac kod upiše u obrazac za upit (ili otvori link s <code>?kod=LJETO10</code> na kraju adrese proizvoda — kod se
          sam primijeni). Popust se računa na iznos nakon količinskog popusta.
        </p>
      </section>

      <CodeTable title="Kodovi" rows={manual} today={today} busy={busy} start={startTransition} empty="Još nema kodova." />

      <section className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Preporuke</h2>
        <p className="text-sm text-black/70">
          Nakon upita za proizvod kupac automatski dobije osobni kod (na ekranu i u potvrdi mailom) koji šalje kolegi. Kolega
          dobiva popust, a kad ga iskoristi, u upitu piše tko ga je preporučio — tada mu ti daš isti popust na sljedeću
          narudžbu. 0 % = preporuke su isključene.
        </p>
        <form action={refAction} className="flex items-end gap-3">
          <Field label="Popust za preporuku (%)">
            <input
              name="referralPercent"
              type="number"
              min={0}
              max={50}
              defaultValue={referralPercent}
              className="admin-input w-28"
            />
          </Field>
          <button
            type="submit"
            disabled={savingRef}
            className="rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
          >
            {savingRef ? "Spremanje…" : "Spremi"}
          </button>
        </form>
        {refState?.error && <p className="text-sm text-red-600">{refState.error}</p>}
        {refState?.success && <p className="text-sm text-green-700">Spremljeno.</p>}
      </section>

      <CodeTable
        title="Kodovi za preporuku"
        rows={referrals}
        today={today}
        busy={busy}
        start={startTransition}
        empty="Još nitko nije dobio kod za preporuku."
      />
    </>
  );
}

function CodeTable({
  title,
  rows,
  today,
  busy,
  start,
  empty,
}: {
  title: string;
  rows: CodeRow[];
  today: string;
  busy: boolean;
  start: (fn: () => void) => void;
  empty: string;
}) {
  return (
    <section className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-3">
      <h2 className="text-sm font-semibold">
        {title} <span className="text-black/40 font-normal">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-black/50">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/50">
                <th className="py-2 pr-3 font-medium">Kod</th>
                <th className="py-2 pr-3 font-medium">Popust</th>
                <th className="py-2 pr-3 font-medium">Iskorišten</th>
                <th className="py-2 pr-3 font-medium">Vrijedi do</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Bilješka</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const st = statusOf(c, today);
                return (
                  <tr key={c.id} className="border-t border-black/10 align-top">
                    <td className="py-2 pr-3 font-mono font-semibold">{c.code}</td>
                    <td className="py-2 pr-3 tabular-nums">−{c.percent} %</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {c.uses}
                      {c.maxUses != null ? ` / ${c.maxUses}` : "×"}
                    </td>
                    <td className="py-2 pr-3">{c.expiresAt ? formatDate(c.expiresAt) : "—"}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${st.tone}`}>{st.label}</span>
                    </td>
                    <td className="py-2 pr-3 text-black/70">
                      {c.referrerEmail ? (
                        <>
                          {c.referrerName} <span className="text-black/40">{c.referrerEmail}</span>
                        </>
                      ) : (
                        c.note || "—"
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => start(() => toggleDiscountCodeAction(c.id, !c.active))}
                        className="text-xs underline mr-3 disabled:opacity-50"
                      >
                        {c.active ? "Isključi" : "Uključi"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Obrisati kod ${c.code}?`)) start(() => deleteDiscountCodeAction(c.id));
                        }}
                        className="text-xs underline text-red-600 disabled:opacity-50"
                      >
                        Obriši
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
