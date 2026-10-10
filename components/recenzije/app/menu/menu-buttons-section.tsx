"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { Switch } from "@/components/recenzije/ui/dialog";
import { Field, Input } from "@/components/recenzije/ui/primitives";
import { BUTTON_LIMITS } from "@/lib/recenzije/menu-buttons";

/** Vrijednosti polja tipki u obrascu (sve kao tekst; prazno = bez tipke). */
export type ButtonsValue = {
  review: boolean;
  wifiName: string;
  wifiPassword: string;
  phone: string;
  email: string;
  address: string;
  instagram: string;
};

/**
 * Odjeljak "Tipke u jelovniku (neobavezno)" u postavkama: do tri male tipke ispod naziva lokala na javnom jelovniku.
 * Stanje drži roditeljski obrazac (isti "nespremljene izmjene" i spremanje kao ostala polja); ovdje su samo polja.
 */
export function MenuButtonsSection({
  value,
  onChange,
  errors,
  hasReviewUrl,
}: {
  value: ButtonsValue;
  onChange: (patch: Partial<ButtonsValue>) => void;
  errors: Record<string, string>;
  hasReviewUrl: boolean;
}) {
  // Isključiti se može uvijek; uključiti samo uz Google link tvrtke.
  const reviewLocked = !hasReviewUrl && !value.review;
  return (
    <section className="border border-border bg-surface-2 p-4" aria-labelledby="m-btn-title">
      <h3 id="m-btn-title" className="text-sm font-bold">
        Tipke u jelovniku (neobavezno)
      </h3>
      <p className="mt-1 text-[13px] text-muted">
        Do tri male tipke ispod naziva lokala na javnom jelovniku. Tipka se pojavljuje samo kad je ispunjena; ako ništa ne upišete, jelovnik izgleda kao i
        prije.
      </p>

      <div className="mt-4 space-y-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="label text-muted">Ocijeni nas</p>
              <p className="mt-1 text-sm font-bold">Tipka Ocijeni nas</p>
              <p className="mt-1 text-[13px] text-muted">
                Otvara vaš Google link za recenzije. Vidi je svaki gost, svima isti link: gosti se ne filtriraju prema ocjeni ni na koji način.
              </p>
            </div>
            <Switch checked={value.review} disabled={reviewLocked} onCheckedChange={(v) => onChange({ review: v })} label="Tipka Ocijeni nas" />
          </div>
          {reviewLocked && (
            <p className="mt-2 flex items-start gap-2 border-l-[3px] border-orange bg-orange-soft p-3 text-[13px] text-foreground/80" role="note">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                Tipka je isključena jer tvrtka još nema Google link za recenzije. Dodajte ga u{" "}
                <Link href="/recenzije/postavke" className="font-bold underline underline-offset-2">
                  Postavkama
                </Link>
                , pa se vratite ovdje.
              </span>
            </p>
          )}
          {value.review && !hasReviewUrl && (
            <p className="mt-2 text-xs text-danger" role="note">
              Google link za recenzije je uklonjen, pa se tipka gostima ne prikazuje. Dodajte link u Postavkama ili isključite tipku.
            </p>
          )}
          {errors.showReviewButton && <p className="mt-1.5 text-xs text-danger">{errors.showReviewButton}</p>}
        </div>

        <div className="border-t border-border pt-4">
          <p className="label text-muted">Wi-Fi</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Wi-Fi naziv" htmlFor="m-wifi-name" error={errors.wifiName}>
              <Input
                id="m-wifi-name"
                value={value.wifiName}
                maxLength={BUTTON_LIMITS.wifiName}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="npr. Konoba-Gosti"
                onChange={(e) => onChange({ wifiName: e.target.value })}
                aria-invalid={errors.wifiName ? true : undefined}
              />
            </Field>
            <Field label="Wi-Fi lozinka" htmlFor="m-wifi-pass" error={errors.wifiPassword}>
              <Input
                id="m-wifi-pass"
                value={value.wifiPassword}
                maxLength={BUTTON_LIMITS.wifiPassword}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="neobavezno"
                onChange={(e) => onChange({ wifiPassword: e.target.value })}
                aria-invalid={errors.wifiPassword ? true : undefined}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">
            Tipka se pojavljuje kad upišete naziv mreže. Lozinka je neobavezna (otvorena mreža: gost vidi samo naziv).{" "}
            <b className="text-foreground/80">Lozinku vidi svatko tko otvori jelovnik</b>, zato ovdje upišite lozinku mreže za goste.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <p className="label text-muted">Kontakt</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Telefon" htmlFor="m-contact-phone" error={errors.contactPhone}>
              <Input
                id="m-contact-phone"
                type="tel"
                inputMode="tel"
                value={value.phone}
                maxLength={BUTTON_LIMITS.phone}
                autoComplete="off"
                placeholder="npr. 021 123 456"
                onChange={(e) => onChange({ phone: e.target.value })}
                aria-invalid={errors.contactPhone ? true : undefined}
              />
            </Field>
            <Field label="E-mail" htmlFor="m-contact-email" error={errors.contactEmail}>
              <Input
                id="m-contact-email"
                type="email"
                inputMode="email"
                value={value.email}
                maxLength={BUTTON_LIMITS.email}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="npr. info@konoba.hr"
                onChange={(e) => onChange({ email: e.target.value })}
                aria-invalid={errors.contactEmail ? true : undefined}
              />
            </Field>
            <Field label="Adresa" htmlFor="m-contact-address" error={errors.contactAddress}>
              <Input
                id="m-contact-address"
                value={value.address}
                maxLength={BUTTON_LIMITS.address}
                autoComplete="off"
                placeholder="npr. Riva 12, Split"
                onChange={(e) => onChange({ address: e.target.value })}
                aria-invalid={errors.contactAddress ? true : undefined}
              />
            </Field>
            <Field label="Instagram" htmlFor="m-contact-ig" error={errors.contactInstagram}>
              <Input
                id="m-contact-ig"
                value={value.instagram}
                maxLength={BUTTON_LIMITS.instagram}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="@konoba ili instagram.com/konoba"
                onChange={(e) => onChange({ instagram: e.target.value })}
                aria-invalid={errors.contactInstagram ? true : undefined}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">
            Gost u ploči Kontakt vidi samo ispunjena polja: Nazovi, Pošalji e-mail, Karta (otvara Google karte s ovom adresom) i Instagram. Ako upišete samo
            telefon, tipka je izravno poziv. Brisanje polja uklanja tu stavku.
          </p>
        </div>
      </div>
    </section>
  );
}
