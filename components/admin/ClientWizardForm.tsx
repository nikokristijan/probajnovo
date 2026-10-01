"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createClientWizardAction, type InviteState } from "@/lib/actions-superadmin";
import InviteResult from "@/components/admin/InviteResult";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-3">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <span className="wizard-step-num" aria-hidden="true">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const field = "flex flex-col gap-1.5 text-sm font-medium";

function WizardInner({ onAgain }: { onAgain: () => void }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createClientWizardAction, undefined);
  const [kind, setKind] = useState<"property" | "company">("property");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [trial, setTrial] = useState(false);

  if (state?.success) {
    return (
      <div className="flex flex-col gap-4">
        <div className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-2" role="status">
          <h2 className="text-base font-semibold">Klijent je dodan.</h2>
          <p className="text-sm text-black/70">
            Stranica je spremljena kao skrivena. Sljedeći korak: dodaj fotografije i opis pa je objavi.
          </p>
          {state.link && <InviteResult email={state.email} link={state.link} emailed={state.emailed} />}
          <div className="flex flex-wrap gap-2 mt-1">
            {state.nextHref && (
              <Link href={state.nextHref} className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2">
                Uredi stranicu
              </Link>
            )}
            <button
              type="button"
              onClick={onAgain}
              className="rounded-full border border-black/20 text-sm font-semibold px-4 py-2"
            >
              Dodaj još jednog
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Step n={1} title="Stranica">
        <div className="flex gap-2" role="radiogroup" aria-label="Vrsta klijenta">
          {(["property", "company"] as const).map((k) => (
            <label key={k} className={"wizard-choice" + (kind === k ? " is-active" : "")}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === "property" ? "Vikendica" : "Firma"}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={field}>
            Naziv
            <input
              name="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              className="admin-input font-normal"
              placeholder={kind === "property" ? "npr. Vila Marija" : "npr. Frizerski salon Ana"}
            />
          </label>
          <label className={field}>
            Adresa stranice
            <div className="flex items-center gap-1 font-normal">
              <span className="text-xs text-black/55 shrink-0">probajnovo.com/</span>
              <input
                name="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                className="admin-input flex-1 min-w-0"
              />
            </div>
          </label>
          <label className={field}>
            Mjesto
            <input name="location" className="admin-input font-normal" placeholder="npr. Slavonski Brod" />
          </label>
          {kind === "property" && (
            <label className={field}>
              Cijena noćenja od (€)
              <input name="priceFromEur" type="number" min={0} inputMode="numeric" defaultValue={80} className="admin-input font-normal" />
            </label>
          )}
          {kind === "property" && (
            <label className={field}>
              Broj gostiju
              <input name="capacityGuests" type="number" min={1} inputMode="numeric" defaultValue={4} className="admin-input font-normal" />
            </label>
          )}
          {kind === "property" && (
            <label className={field}>
              Spavaće sobe
              <input name="bedrooms" type="number" min={0} inputMode="numeric" defaultValue={2} className="admin-input font-normal" />
            </label>
          )}
        </div>
      </Step>

      <Step n={2} title="Pretplata">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={field}>
            Mjesečno (€)
            <input name="monthlyPriceEur" type="number" min={0} inputMode="numeric" defaultValue={0} className="admin-input font-normal" />
            <span className="text-xs font-normal text-black/55">0 = bez pretplate za sada.</span>
          </label>
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <label className="flex items-center gap-2 mt-6 font-normal">
              <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
              Probni period
            </label>
            {trial && (
              <label className="flex items-center gap-2 font-normal">
                <input name="trialDays" type="number" min={1} max={120} defaultValue={30} className="admin-input w-20" aria-label="Broj dana probnog perioda" />
                dana
              </label>
            )}
          </div>
        </div>
      </Step>

      <Step n={3} title="Vlasnik (nije obavezno)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={field}>
            E-mail vlasnika
            <input name="ownerEmail" type="email" className="admin-input font-normal" placeholder="vlasnik@primjer.hr" />
          </label>
          <label className={field}>
            Ime vlasnika
            <input name="ownerName" className="admin-input font-normal" placeholder="npr. Marija" />
          </label>
        </div>
        <p className="text-xs text-black/60">Vlasnik dobiva pozivnicu e-mailom i vidi upite, rezervacije i kalendar samo ove stranice.</p>
      </Step>

      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Spremam…" : "Dodaj klijenta"}
      </button>
    </form>
  );
}

/** Omotač: "Dodaj još jednog" samo promijeni key pa se forma i stanje akcije isprazne. */
export default function ClientWizardForm() {
  const [round, setRound] = useState(0);
  return <WizardInner key={round} onAgain={() => setRound((r) => r + 1)} />;
}
