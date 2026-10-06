"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createInquiryAction, type ActionState } from "@/lib/actions";
import { Button } from "@/components/recenzije/ui/button";
import { Field, Input, Textarea } from "@/components/recenzije/ui/primitives";

/**
 * Upit za NOVO Recenzije. Ide u isti sustav upita kao ostatak probajnova
 * (/admin/inquiries + e-mail obavijest), jer uslugu postavlja i vodi NOVO.
 */
export function OfferForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const business = String(fd.get("business") ?? "").trim();
    const msg = String(fd.get("note") ?? "").trim();
    fd.set(
      "message",
      [`NOVO Recenzije: upit za ponudu`, business ? `Tvrtka/obrt: ${business}` : "", msg].filter(Boolean).join("\n")
    );
    return createInquiryAction(prev, fd);
  }, undefined);
  const [sentName, setSentName] = useState("");

  if (state?.success) {
    return (
      <div className="flex items-start gap-3 border border-foreground bg-white p-5" role="status">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
        <div>
          <p className="font-bold">Hvala{sentName ? `, ${sentName}` : ""}! Upit je stigao.</p>
          <p className="mt-1 text-sm text-muted">Javit ćemo vam se u roku od jednog radnog dana s ponudom i prijedlogom poruke za vaše klijente.</p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => setSentName(String(new FormData(e.currentTarget).get("name") ?? "").split(" ")[0])}
      className="grid gap-4 border border-border bg-white p-5 sm:grid-cols-2 sm:p-6"
    >
      <input type="hidden" name="source" value="agency" />
      <input type="hidden" name="sourceName" value="NOVO Recenzije" />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <Field label="Ime i prezime" htmlFor="offer-name">
        <Input id="offer-name" name="name" required autoComplete="name" />
      </Field>
      <Field label="Tvrtka ili obrt" htmlFor="offer-business">
        <Input id="offer-business" name="business" placeholder="npr. Klima Servis Horvat" />
      </Field>
      <Field label="Email" htmlFor="offer-email">
        <Input id="offer-email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Mobitel" htmlFor="offer-phone" hint="Nije obavezno, ali brže se dogovorimo.">
        <Input id="offer-phone" name="phone" type="tel" autoComplete="tel" placeholder="091 234 5678" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Koliko poslova otprilike odradite mjesečno?" htmlFor="offer-note">
          <Textarea id="offer-note" name="note" rows={3} placeholder="npr. 40 servisa klima mjesečno, imamo 4,6 na Googleu i 23 recenzije." />
        </Field>
      </div>
      {state?.error && (
        <p role="alert" className="border-l-[3px] border-danger bg-danger-soft p-3 text-sm text-danger sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="lg" loading={pending}>
          Zatraži ponudu
        </Button>
        <p className="text-xs text-muted">
          Šaljući upit prihvaćate{" "}
          <Link href="/privatnost" className="underline underline-offset-2">
            politiku privatnosti
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
