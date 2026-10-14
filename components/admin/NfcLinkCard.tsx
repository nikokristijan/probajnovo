"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { NfcLink } from "@/lib/db/schema";
import { restorePreviousNfcLinkAction, setNfcLinkActiveAction, updateNfcLinkTargetAction } from "@/lib/actions-links";

function fmtDate(d: Date | string | null) {
  if (!d) return "još nije otvoren";
  return new Date(d).toLocaleString("hr-HR", { timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Kartica se ponovno montira kad se link spremi (key uključuje updatedAt,
 * vidi app/admin/linkovi), pa polja uvijek pokazuju spremljenu adresu.
 *
 * Jedan dinamički link: kopiraj adresu za oznake, promijeni odredište
 * (vrijedi odmah za SVE oznake s tim linkom), vrati prethodno, isključi.
 */
export default function NfcLinkCard({ link, publicUrl }: { link: NfcLink; publicUrl: string }) {
  const update = updateNfcLinkTargetAction.bind(null, link.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(update, undefined);
  const [target, setTarget] = useState(link.targetUrl);
  const [label, setLabel] = useState(link.label);
  const [copied, setCopied] = useState(false);
  const dirty = target.trim() !== link.targetUrl || label.trim() !== link.label;

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* preglednik ne da kopirati — adresa je ionako vidljiva */
    }
  }

  return (
    <div className={"neu-card p-5 flex flex-col gap-4 " + (link.active ? "" : "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-black/45">Link za oznake</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="font-mono text-sm sm:text-base font-semibold break-all">{publicUrl}</code>
            <button type="button" onClick={copy} className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold">
              {copied ? "Kopirano ✓" : "Kopiraj"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + (link.active ? "bg-green-100 text-green-700" : "bg-black/5 text-black/50")}>
            {link.active ? "aktivan" : "isključen"}
          </span>
          <form action={setNfcLinkActiveAction.bind(null, link.id, !link.active)}>
            <button type="submit" className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold">
              {link.active ? "Isključi" : "Uključi"}
            </button>
          </form>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Interni naziv</span>
            <input name="label" value={label} onChange={(e) => setLabel(e.target.value)} className="admin-input" maxLength={120} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Kamo vodi</span>
            <input name="targetUrl" value={target} onChange={(e) => setTarget(e.target.value)} inputMode="url" required className="admin-input" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || !dirty}
            className="rounded-full bg-black text-white text-sm font-semibold px-5 py-2 disabled:opacity-40"
          >
            {pending ? "Spremanje…" : "Spremi — vrijedi odmah"}
          </button>
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
          {!dirty && link.updatedAt.getTime() - link.createdAt.getTime() > 1000 && (
            <span className="text-sm text-black/50">Zadnja promjena: {fmtDate(link.updatedAt)}</span>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/55">
        <span>
          <b className="text-black/80 tabular-nums">{link.scanCount.toLocaleString("hr-HR")}</b> otvaranja · zadnje: {fmtDate(link.lastScanAt)}
        </span>
        {link.previousUrl && (
          <form action={restorePreviousNfcLinkAction.bind(null, link.id)} className="flex items-center gap-2 min-w-0">
            <span className="truncate max-w-[260px]" title={link.previousUrl}>Prije: {link.previousUrl}</span>
            <button type="submit" className="rounded-full border border-black/15 px-3 py-1 font-semibold shrink-0">
              Vrati prethodno
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
