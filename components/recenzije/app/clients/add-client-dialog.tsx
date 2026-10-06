"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClientAction } from "@/lib/recenzije/actions/clients";
import { Button, type ButtonProps } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/recenzije/ui/dialog";
import { Field, Input, Textarea } from "@/components/recenzije/ui/primitives";
import { initialState } from "@/lib/recenzije/action";

const SERVICE_SUGGESTIONS = ["Servis", "Popravak", "Ugradnja", "Hitna intervencija"];

function todayLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function AddClientForm({
  onDone,
  services,
  technicians,
  openAfter,
}: {
  onDone: (id?: string) => void;
  services: string[];
  technicians: string[];
  openAfter: boolean;
}) {
  const [state, action, pending] = useActionState(createClientAction, initialState);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Klijent dodan");
      onDone(state.data?.id as string | undefined);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onDone]);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const svcOptions = Array.from(new Set([...services, ...SERVICE_SUGGESTIONS]));
  return (
    <form action={action} className="space-y-4" noValidate>
      {openAfter && <input type="hidden" name="open" value="1" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ime" htmlFor="firstName" error={fe.firstName}>
          <Input id="firstName" name="firstName" defaultValue={v.firstName} autoComplete="off" required autoFocus aria-invalid={!!fe.firstName} />
        </Field>
        <Field label="Prezime" htmlFor="lastName" error={fe.lastName}>
          <Input id="lastName" name="lastName" defaultValue={v.lastName} autoComplete="off" />
        </Field>
        <Field label="Mobitel" htmlFor="phone" error={fe.phone} hint="Za SMS. Broj bez +385 dobiva hrvatski pozivni broj.">
          <Input id="phone" name="phone" defaultValue={v.phone} type="tel" inputMode="tel" required aria-invalid={!!fe.phone} placeholder="091 234 5678" />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" defaultValue={v.email} type="email" placeholder="Nije obavezno" />
        </Field>
      </div>
      <div className="border border-border bg-surface-2 p-4">
        <p className="label mb-3 text-foreground">Usluga</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Usluga" htmlFor="service" error={fe.service}>
            <Input id="service" name="service" defaultValue={v.service} list="service-options" placeholder="npr. Servis klime" />
            <datalist id="service-options">
              {svcOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Datum" htmlFor="serviceDate" error={fe.serviceDate}>
            <Input id="serviceDate" name="serviceDate" type="date" defaultValue={v.serviceDate ?? todayLocal()} />
          </Field>
          <Field label="Serviser" htmlFor="technician">
            <Input id="technician" name="technician" defaultValue={v.technician} list="tech-options" placeholder="Nije obavezno" />
            <datalist id="tech-options">
              {technicians.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="completed" defaultChecked={state.values ? v.completed === "on" : true} key={`c-${v.completed}`} className="mt-0.5 size-4 accent-black" />
          <span>
            Posao je završen
            <span className="block text-xs text-muted">Pokreće automatizaciju „završena usluga” (zahtjev za recenziju + podsjetnik).</span>
          </span>
        </label>
      </div>
      <Field label="Bilješke" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={v.notes} rows={2} className="min-h-16" placeholder="Interne bilješke, nije obavezno" />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => onDone()}>
          Odustani
        </Button>
        <Button type="submit" loading={pending}>
          Dodaj klijenta
        </Button>
      </div>
    </form>
  );
}

export function AddClientDialog({
  services = [],
  technicians = [],
  label = "Dodaj klijenta",
  variant = "primary",
  openToClient = false,
}: {
  services?: string[];
  technicians?: string[];
  label?: string;
  variant?: ButtonProps["variant"];
  openToClient?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant}>
          <UserPlus /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent title="Novi klijent" description="Dodajte klijenta nakon posla, a zahtjev za recenziju šaljemo mi." wide>
        <AddClientForm
          key={formKey}
          services={services}
          technicians={technicians}
          openAfter={openToClient}
          onDone={() => {
            setOpen(false);
            setFormKey((k) => k + 1);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
