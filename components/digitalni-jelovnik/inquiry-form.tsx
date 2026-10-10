"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { Field, Input, Select, Textarea } from "@/components/recenzije/ui/primitives";
import { digitalniJelovnikInquiryAction } from "@/app/digitalni-jelovnik/actions";
import { initialState } from "@/lib/recenzije/action";
import { track } from "@/lib/track";

export type PlanOption = { key: string; label: string };

/** Isti ključ kao na obrascima za proizvode i recenzije, pa upit nosi izvor prvog dolaska (oglas, tražilica...). */
const ATTR_KEY = "novo-attribution";

function readAttribution(): string {
  try {
    const saved = sessionStorage.getItem(ATTR_KEY);
    if (saved) return saved;
  } catch {}
  const q = new URLSearchParams(window.location.search);
  const parts: string[] = [];
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = q.get(k);
    if (v) parts.push(`${k.replace("utm_", "")}=${v}`);
  }
  if (q.get("fbclid")) parts.push("fbclid");
  if (q.get("gclid")) parts.push("gclid");
  try {
    if (document.referrer && new URL(document.referrer).host !== window.location.host) parts.push(`ref=${new URL(document.referrer).host}`);
  } catch {}
  const value = parts.length ? `${parts.join(" · ")} · ${window.location.pathname}` : "";
  try {
    if (value) sessionStorage.setItem(ATTR_KEY, value);
  } catch {}
  return value;
}

/**
 * Kratak upit za digitalni jelovnik. Završi u /admin/inquiries kao i svi ostali upiti (vidi app/digitalni-jelovnik/actions.ts);
 * vlasnik lokala ne otvara račun i ništa ne postavlja.
 */
export function DigitalniJelovnikInquiryForm({ plans, defaultPlan }: { plans: PlanOption[]; defaultPlan?: string }) {
  const [state, action, pending] = useActionState(digitalniJelovnikInquiryAction, initialState);
  const [attribution, setAttribution] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    // sessionStorage i URL postoje tek u pregledniku.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttribution(readAttribution());
    setPageUrl(window.location.origin + window.location.pathname);
  }, []);

  // Konverzija za oglase (samo uz pristanak na kolačiće, vidi lib/track).
  useEffect(() => {
    if (!state.ok) return;
    track("Lead", { content_name: "Digitalni jelovnik" });
    (window as Window & { dataLayer?: unknown[] }).dataLayer?.push({ event: "digitalni_jelovnik_inquiry" });
  }, [state.ok]);

  if (state.ok) {
    return (
      <div role="status" className="border-l-[3px] border-success bg-success-soft p-5">
        <p className="label flex items-center gap-2 text-success">
          <CheckCircle2 className="size-4" /> Upit je poslan
        </p>
        <p className="mt-3 text-[17px] leading-relaxed">
          Hvala! Javljamo vam se unutar 24 sata na email ili broj koji ste ostavili. Dogovorimo se oko jelovnika, a sve ostalo radimo mi.
        </p>
      </div>
    );
  }

  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && (
        <div role="alert" className="flex items-start gap-2 border-l-[3px] border-danger bg-danger-soft p-3 text-[15px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <input type="hidden" name="attribution" value={attribution} />
      <input type="hidden" name="pageUrl" value={pageUrl} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Ne popunjavajte ovo polje
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ime i prezime *" htmlFor="dj-name" error={fe.name}>
          <Input id="dj-name" name="name" autoComplete="name" required maxLength={200} aria-invalid={!!fe.name} defaultValue={v.name} className="h-12 text-[17px]" />
        </Field>
        <Field label="Naziv lokala *" htmlFor="dj-business" error={fe.business}>
          <Input id="dj-business" name="business" autoComplete="organization" required maxLength={160} aria-invalid={!!fe.business} defaultValue={v.business} className="h-12 text-[17px]" />
        </Field>
        <Field label="Email *" htmlFor="dj-email" error={fe.email}>
          <Input id="dj-email" name="email" type="email" autoComplete="email" required maxLength={200} aria-invalid={!!fe.email} defaultValue={v.email} className="h-12 text-[17px]" />
        </Field>
        <Field label="Telefon" htmlFor="dj-phone" error={fe.phone} hint="Ako vam je lakše razgovor, ostavite broj pa vas nazovemo.">
          <Input id="dj-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={v.phone} className="h-12 text-[17px]" />
        </Field>
      </div>

      <Field label="Paket" htmlFor="dj-plan" hint="Ne morate se odlučiti sada, pomažemo vam pri izboru.">
        <Select id="dj-plan" name="plan" defaultValue={v.plan ?? defaultPlan ?? ""} className="h-12 text-[17px]">
          <option value="">Još ne znam</option>
          {plans.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Poruka (nije obavezno)" htmlFor="dj-note" error={fe.note}>
        <Textarea
          id="dj-note"
          name="note"
          rows={3}
          maxLength={2000}
          placeholder="Koliko imate stolova, imate li jelovnik na papiru ili u PDF-u, što vas zanima..."
          defaultValue={v.note}
          className="text-[17px]"
        />
      </Field>

      <div>
        <label className="flex min-h-11 items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
          <input type="checkbox" name="consent" required className="mt-1 size-5 shrink-0 accent-black" defaultChecked={v.consent === "on"} />
          <span>
            Slažem se s{" "}
            <Link href="/privatnost" target="_blank" className="text-foreground underline underline-offset-4">
              politikom privatnosti
            </Link>{" "}
            i obradom podataka radi odgovora na upit.
          </span>
        </label>
        {fe.consent && <p className="mt-1.5 text-sm text-danger">{fe.consent}</p>}
      </div>

      <Button type="submit" size="lg" className="h-14 w-full px-8 text-[14px] sm:w-auto" loading={pending}>
        Pošaljite upit →
      </Button>
    </form>
  );
}
