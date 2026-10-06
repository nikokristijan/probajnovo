"use client";

import { useActionState, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { importClientsAction } from "@/lib/recenzije/actions/clients";
import { Button } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/recenzije/ui/dialog";
import { Field, Input, Textarea } from "@/components/recenzije/ui/primitives";
import { initialState } from "@/lib/recenzije/action";

const EXAMPLE = "Ivana Horvat; 091 234 5678; Servis klime; 6.10.2026.\nMarko Babić, 098 765 4321";

function ImportForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(importClientsAction, initialState);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Uvezeno");
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onDone]);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Popis klijenata"
        htmlFor="lines"
        error={fe.lines}
        hint="Jedan klijent po retku: ime i prezime, broj, pa po želji usluga i datum. Razdvojite s ; ili zarezom, ili zalijepite stupce iz Excela."
      >
        <Textarea
          id="lines"
          name="lines"
          rows={8}
          defaultValue={v.lines}
          placeholder={EXAMPLE}
          className="font-mono text-[13px]"
          aria-invalid={!!fe.lines}
          autoFocus
        />
      </Field>
      <Field label="Usluga za retke bez usluge" htmlFor="service" hint="Nije obavezno.">
        <Input id="service" name="service" defaultValue={v.service} placeholder="npr. Servis klime" />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="completed"
          defaultChecked={state.values ? v.completed === "on" : true}
          key={`c-${v.completed}`}
          className="mt-0.5 size-4 accent-black"
        />
        <span>
          Posao je završen, pošalji zahtjev za recenziju
          <span className="block text-xs text-muted">
            Svakom novom klijentu kreće automatizacija (SMS nakon čekanja, pa podsjetnik). Postojeći brojevi se preskaču.
          </span>
        </span>
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Odustani
        </Button>
        <Button type="submit" loading={pending}>
          Uvezi
        </Button>
      </div>
    </form>
  );
}

export function ImportClientsDialog() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const close = () => {
    setOpen(false);
    setFormKey((k) => k + 1);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary">
          <ClipboardList /> Uvezi popis
        </Button>
      </DialogTrigger>
      <DialogContent title="Uvezi klijente" description="Zalijepite popis koji vam je tvrtka poslala (WhatsApp, e-mail ili tablica)." wide>
        <ImportForm key={formKey} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}
