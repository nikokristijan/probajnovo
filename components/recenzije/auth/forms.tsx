"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { forgotPasswordAction, loginAction, resetPasswordAction } from "@/lib/recenzije/actions/auth";
import { Button } from "@/components/recenzije/ui/button";
import { Field, Input } from "@/components/recenzije/ui/primitives";
import { initialState, type ActionState } from "@/lib/recenzije/action";

function FormError({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 border-l-[3px] border-danger bg-danger-soft p-3 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {state.error}
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!state.fieldErrors?.email} defaultValue={state.values?.email} />
      </Field>
      <Field label="Lozinka" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!state.fieldErrors?.password} />
      </Field>
      <div className="flex justify-end">
        <Link href="/recenzije/zaboravljena-lozinka" className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
          Zaboravljena lozinka?
        </Link>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Prijava →
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialState);
  if (state.ok) {
    return (
      <div className="flex items-start gap-3 border-l-[3px] border-success bg-success-soft p-4 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <p>{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Pošalji poveznicu
      </Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      {state.fieldErrors?.token && <FormError state={{ error: "Poveznica nije ispravna. Zatražite novu." }} />}
      <input type="hidden" name="token" value={token} />
      <Field label="Nova lozinka" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Ponovite lozinku" htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Spremi novu lozinku
      </Button>
    </form>
  );
}
