"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { NfcTag } from "@/lib/db/schema";
import ImageUploader from "./ImageUploader";
import { Field } from "./Field";

type NfcTagAction = (
  prevState: ActionState,
  formData: FormData
) => ActionState | Promise<ActionState>;

type FormValues = {
  slug: string;
  label: string;
  wifiSsid: string;
  wifiPassword: string;
  welcomeTitle: string;
  welcomeText: string;
  image: string;
  accentColor: string;
  published: boolean;
  googleReviewUrl: string;
  socialUrl: string;
  contactPhone: string;
  houseRulesText: string;
  localTipsText: string;
};

function initialValues(tag?: NfcTag): FormValues {
  return {
    slug: tag?.slug ?? "",
    label: tag?.label ?? "",
    wifiSsid: tag?.wifiSsid ?? "",
    wifiPassword: tag?.wifiPassword ?? "",
    welcomeTitle: tag?.welcomeTitle ?? "",
    welcomeText: tag?.welcomeText ?? "",
    image: tag?.image ?? "",
    accentColor: tag?.accentColor ?? "#B5502E",
    published: tag?.published ?? true,
    googleReviewUrl: tag?.googleReviewUrl ?? "",
    socialUrl: tag?.socialUrl ?? "",
    contactPhone: tag?.contactPhone ?? "",
    houseRulesText: tag?.houseRulesText ?? "",
    localTipsText: tag?.localTipsText ?? "",
  };
}

// Polja su KONTROLIRANA (React state) jer se <form> resetira nakon svakog
// izvršavanja server akcije (isti razlog kao u PropertyForm/ProductForm).
export default function NfcTagForm({
  tag,
  action,
  submitLabel,
}: {
  tag?: NfcTag;
  action: NfcTagAction;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined
  );
  const [values, setValues] = useState<FormValues>(() => initialValues(tag));

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="Interna oznaka (samo za tebe, gost je ne vidi)">
        <input
          name="label"
          value={values.label}
          onChange={(e) => set("label", e.target.value)}
          required
          placeholder="npr. Duka & Piko — WiFi"
          className="admin-input"
        />
      </Field>

      <Field label="Adresa (probajnovo.com/nfc/...)">
        <input
          name="slug"
          value={values.slug}
          onChange={(e) => set("slug", e.target.value.toLowerCase())}
          required
          pattern="[a-z0-9-]+"
          placeholder="npr. duka-i-piko"
          className="admin-input font-mono"
        />
      </Field>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <p className="text-xs text-black/50 -mb-1">
          Ovo gost vidi i koristi da se spoji na WiFi kad dodirne pločicu telefonom.
        </p>
        <Field label="Naziv WiFi mreže (SSID)">
          <input
            name="wifiSsid"
            value={values.wifiSsid}
            onChange={(e) => set("wifiSsid", e.target.value)}
            required
            placeholder="npr. Duka_Piko_Guest"
            className="admin-input"
          />
        </Field>
        <Field label="Lozinka (prazno = mreža bez lozinke)">
          <input
            name="wifiPassword"
            value={values.wifiPassword}
            onChange={(e) => set("wifiPassword", e.target.value)}
            placeholder="npr. dobrodosli2026"
            className="admin-input"
          />
        </Field>
      </div>

      <Field label="Naslov dobrodošlice (prazno = 'Dobrodošli!')">
        <input
          name="welcomeTitle"
          value={values.welcomeTitle}
          onChange={(e) => set("welcomeTitle", e.target.value)}
          placeholder="npr. Dobrodošli u Duka & Piko!"
          className="admin-input"
        />
      </Field>

      <Field label="Poruka gostu (opcionalno)">
        <textarea
          name="welcomeText"
          value={values.welcomeText}
          onChange={(e) => set("welcomeText", e.target.value)}
          rows={3}
          placeholder="npr. Nadamo se da uživate! Za sva pitanja slobodno nas kontaktirajte."
          className="admin-input"
        />
      </Field>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-5 bg-black/[0.02]">
        <ImageUploader
          label="Slika (opcionalno)"
          helpText="Prikazuje se iznad dobrodošlice — npr. fotka objekta ili domaćina."
          value={values.image ? [values.image] : []}
          onChange={(urls) => set("image", urls[0] ?? "")}
        />
      </div>

      <Field label="Boja akcenta">
        <input
          type="color"
          name="accentColor"
          value={values.accentColor}
          onChange={(e) => set("accentColor", e.target.value)}
          className="h-10 w-20 rounded-lg border border-black/10 cursor-pointer"
        />
      </Field>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <p className="text-xs text-black/50 -mb-1">
          Sve ovo je opcionalno — ako polje ostaviš prazno, ta sekcija se gostu uopće ne prikazuje.
        </p>
        <Field label="Poveznica na Google recenzije">
          <input
            name="googleReviewUrl"
            value={values.googleReviewUrl}
            onChange={(e) => set("googleReviewUrl", e.target.value)}
            placeholder="https://g.page/r/.../review"
            className="admin-input"
          />
        </Field>
        <Field label="Poveznica na društvenu mrežu (Instagram/Facebook)">
          <input
            name="socialUrl"
            value={values.socialUrl}
            onChange={(e) => set("socialUrl", e.target.value)}
            placeholder="https://instagram.com/..."
            className="admin-input"
          />
        </Field>
        <Field label="Telefon za WhatsApp/poziv">
          <input
            name="contactPhone"
            value={values.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
            placeholder="+385 91 234 5678"
            className="admin-input"
          />
        </Field>
        <Field label="Kućni red / upute gostu">
          <textarea
            name="houseRulesText"
            value={values.houseRulesText}
            onChange={(e) => set("houseRulesText", e.target.value)}
            rows={3}
            placeholder={"npr. Odjava do 10h\nNema pušenja u apartmanu\nTiho razdoblje od 22h"}
            className="admin-input"
          />
        </Field>
        <Field label="Lokalne preporuke (restorani, plaže i sl.)">
          <textarea
            name="localTipsText"
            value={values.localTipsText}
            onChange={(e) => set("localTipsText", e.target.value)}
            rows={3}
            placeholder={"npr. Konoba Marul — 5 min pješice\nPlaža Vela Przina — 10 min autom"}
            className="admin-input"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="published"
          checked={values.published}
          onChange={(e) => set("published", e.target.checked)}
        />
        Objavljeno (stranica je dostupna gostima)
      </label>

      {/* Skriveno polje koje server action očekuje kao string */}
      <input type="hidden" name="image" value={values.image} />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Spremljeno.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Spremanje…" : submitLabel}
      </button>
    </form>
  );
}
