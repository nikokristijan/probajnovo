"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { initialState } from "@/lib/recenzije/action";
import { registerWebhooksAction, sendTestSmsAction } from "@/lib/recenzije/actions/novo-admin";

/**
 * Zajednički NOVO mobitel (SMS Gateway for Android) s kojeg odlaze SVE poruke svih klijenata.
 * Stanje stiže sa servera; probni SMS i povezivanje webhookova su server radnje samo za glavnog
 * admina. Prava greška (npr. mobitel nedostupan) prikazuje se onakva kakva jest.
 */

export type NovoPhoneView =
  | { available: true; configured: boolean; missing: string[]; webhookUrl: string; signingKeyConfigured: boolean }
  | { available: false; error: string };

function SubmitButton({ children, pendingLabel, className, disabled }: { children: string; pendingLabel: string; className: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className + " disabled:opacity-50 disabled:cursor-not-allowed"}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function Notice({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div
      role={ok ? "status" : "alert"}
      className={
        "rounded-xl border px-3.5 py-2 text-sm break-words " +
        (ok ? "border-[#0b7a3e]/30 bg-[#0b7a3e]/5" : "border-[#d70015]/30 bg-[#d70015]/5 text-[#b80012]")
      }
    >
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40 shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* adresa je označiva jednim klikom pa se može kopirati ručno */
        }
      }}
    >
      {copied ? "Kopirano" : "Kopiraj"}
    </button>
  );
}

export default function RecenzijeNovoPhoneCard({ phone }: { phone: NovoPhoneView }) {
  const [test, testAction] = useActionState(sendTestSmsAction, initialState);
  const [hooks, hooksAction] = useActionState(registerWebhooksAction, initialState);

  const ready = phone.available && phone.configured;
  // Dok status nije dostupan, gumbi ostaju uključeni da se vidi prava greška; inače čekaju postavke.
  const blocked = phone.available && !phone.configured;

  return (
    <section className="neu-card px-4 py-4 flex flex-col gap-4" aria-labelledby="novo-mobitel">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 id="novo-mobitel" className="font-semibold text-sm">
            NOVO mobitel za SMS
          </h2>
          <p className="text-xs text-black/55 mt-0.5 max-w-[60ch]">
            Jedan zajednički mobitel šalje poruke svih klijenata. Tekst poruke sadrži naziv klijentove tvrtke.
          </p>
        </div>
        <span
          className={
            "text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 " +
            (ready
              ? "bg-[#0b7a3e]/10 text-[#0b7a3e]"
              : phone.available
                ? "bg-[#ff7f00]/12 text-[#9a4a00]"
                : "bg-[#d70015]/8 text-[#b80012]")
          }
        >
          {ready ? "Spreman za slanje" : phone.available ? "Nije postavljen" : "Status nedostupan"}
        </span>
      </div>

      {!phone.available && <Notice ok={false}>Status nije moguće pročitati: {phone.error}</Notice>}

      {phone.available && phone.missing.length > 0 && (
        <div className="rounded-xl border border-[#ff7f00]/30 bg-[#ff7f00]/5 px-3.5 py-2.5 text-sm">
          <div className="font-semibold">Još fali u postavkama servera (env varijable):</div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {phone.missing.map((name) => (
              <li key={name}>
                <code className="font-mono text-xs bg-black/5 rounded px-1.5 py-0.5 break-all">{name}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phone.available && (
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="text-black/55">Webhook adresa (odgovori i isporuka):</div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-xs break-all select-all min-w-0 flex-1 basis-60">{phone.webhookUrl}</code>
            <CopyButton text={phone.webhookUrl} />
          </div>
          <div className="text-black/55">
            Potpisni ključ webhookova:{" "}
            <b className={phone.signingKeyConfigured ? "text-[#0b7a3e]" : "text-[#9a4a00]"}>
              {phone.signingKeyConfigured ? "postavljen" : "nije postavljen"}
            </b>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={testAction} className="flex flex-col gap-2" noValidate>
          <label className="flex flex-col gap-1 text-xs text-black/60">
            Probni SMS na broj
            <input
              name="to"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="npr. 091 234 5678"
              defaultValue={test.values?.to}
              className="admin-input text-sm"
              aria-invalid={!!test.fieldErrors?.to}
              disabled={blocked}
            />
            {test.fieldErrors?.to && <span className="text-[11px] text-[#b80012]">{test.fieldErrors.to}</span>}
          </label>
          <div>
            <SubmitButton
              pendingLabel="Šaljem…"
              disabled={blocked}
              className="rounded-full bg-black text-white text-xs font-semibold px-4 py-2"
            >
              Pošalji probni SMS
            </SubmitButton>
          </div>
          {test.error && <Notice ok={false}>{test.error}</Notice>}
          {test.ok && test.message && <Notice ok>{test.message}</Notice>}
        </form>

        <form action={hooksAction} className="flex flex-col gap-2">
          <div className="text-xs text-black/60">
            Jednim klikom upiše gornju webhook adresu u aplikaciju na mobitelu da se odgovori klijenata i isporuka vide u poruci.
          </div>
          <div>
            <SubmitButton
              pendingLabel="Povezujem…"
              disabled={blocked}
              className="text-xs font-semibold px-4 py-2 rounded-full border border-black/15 hover:border-black/40"
            >
              Poveži webhookove
            </SubmitButton>
          </div>
          {hooks.error && <Notice ok={false}>{hooks.error}</Notice>}
          {hooks.ok && hooks.message && <Notice ok>{hooks.message}</Notice>}
        </form>
      </div>
    </section>
  );
}
