"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/lib/recenzije/actions/org";
import { Button } from "@/components/recenzije/ui/button";
import { Field, Input, Select } from "@/components/recenzije/ui/primitives";
import { initialState } from "@/lib/recenzije/action";
import { INDUSTRIES, TIMEZONES } from "@/lib/recenzije/constants";


export function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, initialState);
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <p className="border-l-[3px] border-danger bg-danger-soft p-3 text-sm text-danger">{state.error}</p>}
      <Field label="Naziv tvrtke ili obrta" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" placeholder="npr. Klima Servis Horvat" required autoFocus defaultValue={v.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Djelatnost" htmlFor="industry">
          <Select id="industry" name="industry" defaultValue={v.industry ?? "Klimatizacija i grijanje"} key={`i-${v.industry}`}>
            {INDUSTRIES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </Field>
        <Field label="Vremenska zona" htmlFor="timezone">
          <Select id="timezone" name="timezone" defaultValue={v.timezone ?? "Europe/Zagreb"} key={`t-${v.timezone}`}>
            {TIMEZONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Telefon tvrtke" htmlFor="phone" error={state.fieldErrors?.phone} hint="Nije obavezno. Vidite ga samo vi.">
        <Input id="phone" name="phone" type="tel" placeholder="+385 91 234 5678" defaultValue={v.phone} />
      </Field>
      <Field
        label="Link za Google recenzije"
        htmlFor="googleReviewUrl"
        error={state.fieldErrors?.googleReviewUrl}
        hint="Nije obavezno sada. U Google Business Profileu: Zatraži recenzije → kopiraj link. Google možete povezati i kasnije."
      >
        <Input id="googleReviewUrl" name="googleReviewUrl" type="url" placeholder="https://g.page/r/…/review" defaultValue={v.googleReviewUrl} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Otvori radni prostor →
      </Button>
    </form>
  );
}
