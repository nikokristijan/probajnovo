"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { EmptyState } from "@/components/admin/EmptyState";
import { initialState } from "@/lib/recenzije/action";
import { createInviteCodeAction, revokeInviteCodeAction } from "@/lib/recenzije/actions/novo-admin";

/**
 * Pozivni kodovi za registraciju u NOVO Recenzije (samo glavni admin; svaku radnju
 * na serveru ponovno provjerava requireSuperAdmin). Datumi stižu već formatirani
 * sa servera da se ne razilaze između servera i preglednika.
 */

export type InviteCodeView = {
  id: string;
  code: string;
  label: string | null;
  status: "active" | "used" | "expired" | "revoked";
  uses: number;
  maxUses: number;
  expiresLabel: string | null;
  createdLabel: string;
  lastUsedBy: string | null;
  lastUsedLabel: string | null;
};

const STATUS: Record<InviteCodeView["status"], { label: string; cls: string }> = {
  active: { label: "aktivan", cls: "bg-[#0b7a3e]/10 text-[#0b7a3e]" },
  used: { label: "iskorišten", cls: "bg-black/5 text-black/55" },
  expired: { label: "istekao", cls: "bg-[#ff7f00]/12 text-[#9a4a00]" },
  revoked: { label: "opozvan", cls: "bg-[#d70015]/8 text-[#b80012]" },
};

function CopyButton({ text, label = "Kopiraj" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs font-semibold px-3.5 py-2 rounded-full border border-black/15 hover:border-black/40"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* kod je označiv jednim klikom (select-all), pa ga se može kopirati ručno */
        }
      }}
    >
      {copied ? "Kopirano" : label}
    </button>
  );
}

function SubmitButton({ children, pendingLabel, className }: { children: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className + " disabled:opacity-60"}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-[11px] text-[#b80012]">{message}</span>;
}

export default function RecenzijeInviteCodes({ codes, envCount }: { codes: InviteCodeView[]; envCount: number }) {
  const [created, createAction] = useActionState(createInviteCodeAction, initialState);
  const [revoked, revokeAction] = useActionState(revokeInviteCodeAction, initialState);
  const newCode = created.ok && typeof created.data?.code === "string" ? created.data.code : null;
  const active = codes.filter((c) => c.status === "active").length;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pozivni-kodovi">
      <div>
        <h2 id="pozivni-kodovi" className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Pozivni kodovi · aktivnih: {active}
        </h2>
        <p className="text-xs text-black/50 mt-0.5 max-w-[70ch]">
          Račun u Recenzijama može otvoriti samo osoba s kodom. Kod vrijedi dok se ne potroše sve upotrebe, ne istekne ili ga ne opozoveš.
          {envCount > 0 && (
            <>
              {" "}
              Dodatno vrijede kodovi iz postavki servera (NR_INVITE_CODES, {envCount}), bez ograničenja upotreba.
            </>
          )}
        </p>
      </div>

      <form action={createAction} className="neu-card px-4 py-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <label className="flex flex-col gap-1 text-xs text-black/60 flex-1 min-w-[12rem]">
            Za koga (bilješka)
            <input
              name="label"
              maxLength={80}
              placeholder="npr. Frizerski salon Ana"
              autoComplete="off"
              defaultValue={created.values?.label}
              className="admin-input text-sm"
              aria-invalid={!!created.fieldErrors?.label}
            />
            <FieldError message={created.fieldErrors?.label} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 w-28">
            Broj upotreba
            <input
              name="maxUses"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              defaultValue={created.values?.maxUses ?? 1}
              className="admin-input text-sm"
              aria-invalid={!!created.fieldErrors?.maxUses}
            />
            <FieldError message={created.fieldErrors?.maxUses} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 w-36">
            Vrijedi (dana)
            <input
              name="expiresInDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              placeholder="bez isteka"
              defaultValue={created.values?.expiresInDays}
              className="admin-input text-sm"
              aria-invalid={!!created.fieldErrors?.expiresInDays}
            />
            <FieldError message={created.fieldErrors?.expiresInDays} />
          </label>
          <div className="flex items-end self-end">
            <SubmitButton pendingLabel="Radim…" className="rounded-full bg-black text-white text-xs font-semibold px-4 py-2">
              Napravi kod
            </SubmitButton>
          </div>
        </div>

        {created.error && (
          <div role="alert" className="rounded-xl border border-[#d70015]/30 bg-[#d70015]/5 px-4 py-2.5 text-sm text-[#b80012]">
            {created.error}
          </div>
        )}
        {newCode && (
          <div role="status" className="rounded-xl border border-[#0b7a3e]/30 bg-[#0b7a3e]/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-black/60">Novi pozivni kod</div>
              <code className="font-mono text-base font-bold tracking-wider select-all break-all">{newCode}</code>
            </div>
            <CopyButton text={newCode} label="Kopiraj kod" />
          </div>
        )}
      </form>

      {revoked.error && (
        <div role="alert" className="rounded-xl border border-[#d70015]/30 bg-[#d70015]/5 px-4 py-2.5 text-sm text-[#b80012]">
          {revoked.error}
        </div>
      )}

      {codes.length === 0 ? (
        <EmptyState title="Nema pozivnih kodova" hint="Napravi prvi kod gore i pošalji ga osobi kojoj želiš otvoriti račun." />
      ) : (
        <ul className="flex flex-col gap-2">
          {codes.map((c) => {
            const st = STATUS[c.status];
            const live = c.status === "active";
            return (
              <li key={c.id} className="neu-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className={"min-w-0 " + (live ? "" : "opacity-70")}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-sm font-semibold tracking-wider select-all">{c.code}</code>
                    <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + st.cls}>{st.label}</span>
                  </div>
                  <div className="text-xs text-black/55 mt-0.5 break-words">
                    {c.label ? `${c.label} · ` : ""}
                    iskorišteno <b className="tabular-nums text-black">{c.uses}/{c.maxUses}</b>
                    {" · "}
                    {c.expiresLabel ? `vrijedi do ${c.expiresLabel}` : "bez isteka"}
                    {` · napravljen ${c.createdLabel}`}
                    {c.lastUsedBy ? ` · zadnji: ${c.lastUsedBy}${c.lastUsedLabel ? ` (${c.lastUsedLabel})` : ""}` : ""}
                  </div>
                </div>
                {live && (
                  <div className="flex items-center gap-2 shrink-0">
                    <CopyButton text={c.code} />
                    <form action={revokeAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton
                        pendingLabel="Opozivam…"
                        className="text-xs font-semibold px-3.5 py-2 rounded-full border border-[#d70015]/30 text-[#b80012] hover:border-[#d70015]/60"
                      >
                        Opozovi
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
