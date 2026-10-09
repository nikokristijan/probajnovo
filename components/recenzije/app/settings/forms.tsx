"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { updateAccountAction, updateBusinessAction } from "@/lib/recenzije/actions/org";
import { disconnectGoogleAction, refreshGoogleLocationAction, removeSmsGatewayAction } from "@/lib/recenzije/actions/settings";
import { Button } from "@/components/recenzije/ui/button";
import { Field, Input, Label, Select } from "@/components/recenzije/ui/primitives";
import { type ActionState, initialState } from "@/lib/recenzije/action";
import { INDUSTRIES, TIMEZONES } from "@/lib/recenzije/constants";

function useToastOnState(state: ActionState) {
  useEffect(() => {
    if (state.ok) toast.success(state.message ?? "Spremljeno");
    else if (state.error) toast.error(state.error);
  }, [state]);
}

/** Link se otvara u novoj kartici samo ako je https adresa (nikad javascript: ni slično). */
function isTestableUrl(v: string) {
  return /^https:\/\/\S+$/i.test(v.trim());
}

export function BusinessForm({
  org,
  canEdit,
  demo,
}: {
  org: { id: string; name: string; industry: string | null; phone: string | null; timezone: string; googleReviewUrl: string | null; googlePlaceId: string | null };
  canEdit: boolean;
  demo?: boolean;
}) {
  const [state, action, pending] = useActionState(updateBusinessAction, initialState);
  useToastOnState(state);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const [url, setUrl] = useState(org.googleReviewUrl ?? "");
  const testable = isTestableUrl(url);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orgId" value={org.id} />
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Naziv tvrtke" htmlFor="b-name" error={fe.name} hint="Tako se tvrtka potpisuje u SMS porukama.">
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
          <Field label="Telefon tvrtke" htmlFor="b-phone" error={fe.phone}>
            <Input id="b-phone" name="phone" type="tel" defaultValue={v.phone ?? org.phone ?? ""} />
          </Field>
        </div>
        <div>
          <div className="flex flex-wrap items-end justify-between gap-x-3">
            <Label htmlFor="b-url">Link za Google recenzije</Label>
            {testable && (
              <a
                href={url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="label mb-2 inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
              >
                Testiraj link <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>
          <Input
            id="b-url"
            name="googleReviewUrl"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
            aria-invalid={fe.googleReviewUrl ? true : undefined}
          />
          {fe.googleReviewUrl ? (
            <p className="mt-1.5 text-xs text-danger">{fe.googleReviewUrl}</p>
          ) : (
            <p className="mt-1.5 text-xs text-muted">Kamo vode praćeni linkovi u SMS-u i QR plakat.</p>
          )}
        </div>
        <Field label="Vremenska zona" htmlFor="b-tz" hint="Određuje datume u izvještajima i zadanu državu za brojeve upisane bez pozivnog broja.">
          <Select id="b-tz" name="timezone" defaultValue={v.timezone ?? org.timezone}>
            {TIMEZONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <details className="border border-border bg-surface-2 px-3 py-2.5 [&[open]>summary]:mb-3">
          <summary className="label cursor-pointer select-none text-muted">Napredno</summary>
          <Field label="Google Place ID" htmlFor="b-place" hint="Nije obavezno. Za izradu linka i za preuzimanje recenzija preko Places API-ja.">
            <Input id="b-place" name="googlePlaceId" defaultValue={v.googlePlaceId ?? org.googlePlaceId ?? ""} placeholder="ChIJ…" />
          </Field>
        </details>
      </fieldset>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Spremi
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">
          {demo ? "Ovo je primjer za razgledavanje, izmjene su isključene." : "Podatke tvrtke mogu mijenjati samo vlasnik i admini."}
        </p>
      )}
    </form>
  );
}

/** Račun starih korisnika (klijenti više nemaju prijavu). NOVO tim ga ne koristi. */
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
      <Field label="Email" htmlFor="u-email" hint="Za promjenu emaila za prijavu javite se NOVO-u.">
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

/** Ostatak starog načina (vlastiti mobitel tvrtke): jednim klikom slanje prelazi na NOVO broj. */
export function LegacyPhoneSwitch({ canEdit }: { canEdit: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={!canEdit || pending}
      onClick={() =>
        start(async () => {
          const r = await removeSmsGatewayAction();
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        })
      }
    >
      <Unplug /> Prebaci na NOVO broj
    </Button>
  );
}
