"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Ban, CheckCircle2, Ellipsis, Pencil, Plus, Send, Star, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  addServiceAction,
  completeServiceAction,
  deleteClientAction,
  markReviewedAction,
  sendReviewRequestAction,
  setClientStatusAction,
  toggleOptOutAction,
  updateClientAction,
} from "@/lib/recenzije/actions/clients";
import { Button } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent, DialogTrigger, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/recenzije/ui/dialog";
import { Field, Input, Textarea } from "@/components/recenzije/ui/primitives";
import { type ActionState, initialState } from "@/lib/recenzije/action";

function useToastAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Gotovo");
      else if (r.error) toast.error(r.error);
    });
  return { pending, run };
}

export function ClientHeaderActions({
  clientId,
  reviewed,
  optOut,
  client,
}: {
  clientId: string;
  reviewed: boolean;
  optOut: boolean;
  client: { firstName: string; lastName: string; phone: string; email: string | null; notes: string | null };
}) {
  const send = useToastAction();
  const other = useToastAction();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!reviewed && !optOut && (
        <Button loading={send.pending} onClick={() => send.run(() => sendReviewRequestAction(clientId))}>
          {!send.pending && <Send />} Pošalji zahtjev za recenziju
        </Button>
      )}
      {!reviewed && (
        <Button variant="secondary" loading={other.pending} onClick={() => other.run(() => markReviewedAction(clientId))}>
          <Star /> Označi: ostavio recenziju
        </Button>
      )}
      <Menu>
        <MenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Više radnji">
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Uredi klijenta
          </MenuItem>
          {reviewed && (
            <MenuItem onSelect={() => other.run(() => setClientStatusAction(clientId, "COMPLETED"))}>
              <CheckCircle2 /> Označi kao završeno
            </MenuItem>
          )}
          <MenuItem onSelect={() => other.run(() => toggleOptOutAction(clientId, !optOut))}>
            <Ban /> {optOut ? "Ponovno uključi SMS" : "Zaustavi sve SMS-ove (odjava)"}
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => setConfirmDelete(true)}>
            <Trash2 /> Obriši klijenta
          </MenuItem>
        </MenuContent>
      </Menu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title="Uredi klijenta">
          <EditClientForm clientId={clientId} client={client} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          title="Obrisati klijenta?"
          description="Brišu se klijent, njegove usluge, poruke i praćeni linkovi. Preuzete Google recenzije ostaju. Ovo se ne može poništiti."
        >
          <form action={deleteClientAction.bind(null, clientId)} className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Odustani
            </Button>
            <Button type="submit" variant="danger">
              <Trash2 /> Obriši klijenta
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditClientForm({
  clientId,
  client,
  onDone,
}: {
  clientId: string;
  client: { firstName: string; lastName: string; phone: string; email: string | null; notes: string | null };
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateClientAction, initialState);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Spremljeno");
      onDone();
    } else if (state.error) toast.error(state.error);
  }, [state, onDone]);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={clientId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ime" htmlFor="e-first" error={fe.firstName}>
          <Input id="e-first" name="firstName" defaultValue={v.firstName ?? client.firstName} required />
        </Field>
        <Field label="Prezime" htmlFor="e-last">
          <Input id="e-last" name="lastName" defaultValue={v.lastName ?? client.lastName} />
        </Field>
        <Field label="Mobitel" htmlFor="e-phone" error={fe.phone}>
          <Input id="e-phone" name="phone" type="tel" defaultValue={v.phone ?? client.phone} required />
        </Field>
        <Field label="Email" htmlFor="e-email" error={fe.email}>
          <Input id="e-email" name="email" type="email" defaultValue={v.email ?? client.email ?? ""} />
        </Field>
      </div>
      <Field label="Bilješke" htmlFor="e-notes">
        <Textarea id="e-notes" name="notes" defaultValue={v.notes ?? client.notes ?? ""} rows={3} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Odustani
        </Button>
        <Button type="submit" loading={pending}>
          Spremi
        </Button>
      </div>
    </form>
  );
}

export function CompleteServiceButton({ serviceId }: { serviceId: string }) {
  const { pending, run } = useToastAction();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => completeServiceAction(serviceId))}>
      {!pending && <CheckCircle2 />} Označi završenim
    </Button>
  );
}

export function AddServiceDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setKey((k) => k + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus /> Dodaj uslugu
        </Button>
      </DialogTrigger>
      <DialogContent title="Nova usluga" description="Zabilježite novi posao za ovog klijenta.">
        <AddServiceForm
          key={key}
          clientId={clientId}
          onDone={() => {
            setOpen(false);
            setKey((k) => k + 1);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function AddServiceForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(addServiceAction, initialState);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Usluga dodana");
      onDone();
    } else if (state.error) toast.error(state.error);
  }, [state, onDone]);
  const [today] = useState(localToday);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      <Field label="Usluga" htmlFor="s-name" error={state.fieldErrors?.service}>
        <Input id="s-name" name="service" required placeholder="npr. Servis klime" defaultValue={state.values?.service} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Datum" htmlFor="s-date" error={state.fieldErrors?.serviceDate}>
          <Input id="s-date" name="serviceDate" type="date" defaultValue={today} />
        </Field>
        <Field label="Serviser" htmlFor="s-tech">
          <Input id="s-tech" name="technician" defaultValue={state.values?.technician} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="completed" defaultChecked className="mt-0.5 size-4 accent-black" />
        <span>
          Posao je završen <span className="block text-xs text-muted">Pokreće automatizaciju „završena usluga”.</span>
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Odustani
        </Button>
        <Button type="submit" loading={pending}>
          <Wrench /> Dodaj uslugu
        </Button>
      </div>
    </form>
  );
}

export function CopyButton({ value, label = "Kopiraj" }: { value: string; label?: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Kopirano");
        } catch {
          toast.error("Kopiranje nije uspjelo. Označite tekst i kopirajte ručno.");
        }
      }}
    >
      {label}
    </Button>
  );
}
