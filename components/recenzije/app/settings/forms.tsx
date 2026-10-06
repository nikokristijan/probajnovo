"use client";

import { useActionState, useEffect, useTransition } from "react";
import { RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { updateAccountAction, updateBusinessAction } from "@/lib/recenzije/actions/org";
import { disconnectGoogleAction, refreshGoogleLocationAction, removeSmsGatewayAction, saveSmsGatewayAction } from "@/lib/recenzije/actions/settings";
import { Button } from "@/components/recenzije/ui/button";
import { Field, Input, Select } from "@/components/recenzije/ui/primitives";
import { type ActionState, initialState } from "@/lib/recenzije/action";
import { INDUSTRIES, TIMEZONES } from "@/lib/recenzije/constants";

function useToastOnState(state: ActionState) {
  useEffect(() => {
    if (state.ok) toast.success(state.message ?? "Spremljeno");
    else if (state.error) toast.error(state.error);
  }, [state]);
}

export function BusinessForm({
  org,
  canEdit,
}: {
  org: { name: string; industry: string | null; phone: string | null; timezone: string; googleReviewUrl: string | null; googlePlaceId: string | null };
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateBusinessAction, initialState);
  useToastOnState(state);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Naziv tvrtke" htmlFor="b-name" error={fe.name}>
          <Input id="b-name" name="name" defaultValue={v.name ?? org.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Djelatnost" htmlFor="b-industry">
            <Select id="b-industry" name="industry" defaultValue={v.industry ?? org.industry ?? "Ostalo"}>
              {INDUSTRIES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </Select>
          </Field>
          <Field label="Vremenska zona" htmlFor="b-tz">
            <Select id="b-tz" name="timezone" defaultValue={v.timezone ?? org.timezone}>
              {TIMEZONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Telefon tvrtke" htmlFor="b-phone" error={fe.phone}>
          <Input id="b-phone" name="phone" type="tel" defaultValue={v.phone ?? org.phone ?? ""} />
        </Field>
        <Field
          label="Link za Google recenzije"
          htmlFor="b-url"
          error={fe.googleReviewUrl}
          hint="Kamo praćeni linkovi vode klijente. Popunjava se sam kad povežete Google."
        >
          <Input id="b-url" name="googleReviewUrl" type="url" defaultValue={v.googleReviewUrl ?? org.googleReviewUrl ?? ""} placeholder="https://g.page/r/…/review" />
        </Field>
        <Field label="Google Place ID" htmlFor="b-place" hint="Nije obavezno. Služi za izradu linka i za Places API.">
          <Input id="b-place" name="googlePlaceId" defaultValue={v.googlePlaceId ?? org.googlePlaceId ?? ""} placeholder="ChIJ…" />
        </Field>
      </fieldset>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Spremi profil tvrtke
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Profil tvrtke mogu mijenjati samo vlasnik i admini.</p>
      )}
    </form>
  );
}

export function AccountForm({ name, email, hasPassword }: { name: string; email: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState(updateAccountAction, initialState);
  useToastOnState(state);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4">
      <Field label="Ime i prezime" htmlFor="u-name" error={fe.name}>
        <Input id="u-name" name="name" defaultValue={v.name ?? name} required />
      </Field>
      <Field label="Email" htmlFor="u-email" hint="Za promjenu emaila za prijavu javite se podršci.">
        <Input id="u-email" value={email} disabled readOnly />
      </Field>
      <div className="border-t border-border pt-4">
        <p className="label mb-3">{hasPassword ? "Promjena lozinke" : "Postavite lozinku"}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {hasPassword && (
            <Field label="Trenutna lozinka" htmlFor="u-cur" error={fe.currentPassword}>
              <Input id="u-cur" name="currentPassword" type="password" autoComplete="current-password" />
            </Field>
          )}
          <Field label="Nova lozinka" htmlFor="u-new" error={fe.newPassword} hint="Ostavite prazno ako ne mijenjate.">
            <Input id="u-new" name="newPassword" type="password" autoComplete="new-password" />
          </Field>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Spremi račun
        </Button>
      </div>
    </form>
  );
}

export function GoogleActions() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(refreshGoogleLocationAction)}>
        <RefreshCw /> Osvježi lokaciju
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(disconnectGoogleAction)}>
        <Unplug /> Odspoji
      </Button>
    </div>
  );
}

/** Povezivanje mobitela tvrtke (SMS Gateway for Android). */
export function SmsGatewayForm({ connectedUser, hasSigningKey, canEdit }: { connectedUser: string | null; hasSigningKey: boolean; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveSmsGatewayAction, initialState);
  const [removing, start] = useTransition();
  useToastOnState(state);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Korisničko ime (Username)" htmlFor="gw-user" error={fe.user}>
          <Input id="gw-user" name="user" autoComplete="off" defaultValue={v.user ?? connectedUser ?? ""} placeholder="npr. ABCD12" />
        </Field>
        <Field label="Lozinka (Password)" htmlFor="gw-pass" error={fe.pass} hint={connectedUser ? "Upišite ponovno samo ako je mijenjate." : undefined}>
          <Input id="gw-pass" name="pass" type="password" autoComplete="new-password" />
        </Field>
        <Field
          label="Ključ za potpis (Signing key)"
          htmlFor="gw-key"
          className="sm:col-span-2"
          hint={hasSigningKey ? "Spremljen. Upišite novi samo ako ste ga promijenili u aplikaciji." : "Aplikacija → Settings → Webhooks → Signing Key. Potreban za potvrde isporuke i odgovore."}
        >
          <Input id="gw-key" name="signingKey" type="password" autoComplete="off" />
        </Field>
      </fieldset>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {connectedUser ? "Spremi i ponovno poveži" : "Poveži mobitel"}
          </Button>
          {connectedUser && (
            <Button
              type="button"
              variant="ghost"
              disabled={removing}
              onClick={() =>
                start(async () => {
                  const r = await removeSmsGatewayAction();
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.error);
                })
              }
            >
              <Unplug /> Odspoji
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
