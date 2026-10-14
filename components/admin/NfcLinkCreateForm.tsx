"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions";
import { createNfcLinkAction } from "@/lib/actions-links";
import { Field } from "./Field";

/** Novi dinamički link (vidi app/admin/linkovi). Kod se sam izmisli ako je prazan. */
export default function NfcLinkCreateForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createNfcLinkAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="neu-card p-5 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Interni naziv (vidiš ga samo ti)">
          <input name="label" required maxLength={120} placeholder="npr. Padel klub Brod — serija 1" className="admin-input" />
        </Field>
        <Field label="Kamo vodi (odredište)">
          <input name="targetUrl" required inputMode="url" placeholder="npr. https://playtomic.io/klub-xyz" className="admin-input" />
        </Field>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-black/60">Vlastiti kod u linku (neobavezno)</summary>
        <div className="mt-3 max-w-xs">
          <Field label="Kod (prazno = automatski, npr. k7m3qa)">
            <input name="code" pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]" placeholder="npr. padel1" className="admin-input font-mono" />
          </Field>
        </div>
      </details>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Link je napravljen — kopiraj ga ispod i upiši na oznake.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Spremanje…" : "+ Napravi link"}
      </button>
    </form>
  );
}
