"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { Product } from "@/lib/db/schema";
import ImageUploader from "./ImageUploader";

type ProductAction = (
  prevState: ActionState,
  formData: FormData
) => ActionState | Promise<ActionState>;

type FormValues = {
  name: string;
  tagline: string;
  description: string;
  priceEur: string;
  images: string[];
  features: string;
  published: boolean;
  position: string;
};

function initialValues(product?: Product): FormValues {
  return {
    name: product?.name ?? "",
    tagline: product?.tagline ?? "",
    description: product?.description ?? "",
    priceEur: product?.priceEur != null ? String(product.priceEur) : "",
    images: product?.images ?? [],
    features: (product?.features ?? []).join("\n"),
    published: product?.published ?? true,
    position: String(product?.position ?? 0),
  };
}

// Polja su KONTROLIRANA (React state) jer se <form> resetira nakon svakog
// izvršavanja server akcije (isti razlog kao u PropertyForm/StudyForm).
export default function ProductForm({
  product,
  action,
  submitLabel,
}: {
  product?: Product;
  action: ProductAction;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined
  );
  const [values, setValues] = useState<FormValues>(() => initialValues(product));

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="Naziv proizvoda">
        <input
          name="name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          required
          placeholder="npr. NFC pločica — Google recenzije"
          className="admin-input"
        />
      </Field>

      <Field label="Kratki opis (prikazan na kartici proizvoda)">
        <input
          name="tagline"
          value={values.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          required
          placeholder="npr. 3D printana pločica koja gosta jednim dodirom vodi na recenziju"
          className="admin-input"
        />
      </Field>

      <Field label="Puni opis (prikazuje se u pop-up prozoru)">
        <textarea
          name="description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          required
          rows={5}
          className="admin-input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Cijena u € (prazno = 'na upit')">
          <input
            name="priceEur"
            type="number"
            min={0}
            step={1}
            value={values.priceEur}
            onChange={(e) => set("priceEur", e.target.value)}
            placeholder="npr. 25"
            className="admin-input"
          />
        </Field>
        <Field label="Redoslijed (manji broj = prije u popisu)">
          <input
            name="position"
            type="number"
            value={values.position}
            onChange={(e) => set("position", e.target.value)}
            className="admin-input"
          />
        </Field>
      </div>

      <Field label="Značajke — jedna po retku (prikazuju se kao chipovi)">
        <textarea
          name="features"
          value={values.features}
          onChange={(e) => set("features", e.target.value)}
          rows={4}
          placeholder={"NFC oznaka\nVodootporno\nPrilagođeni dizajn\nIzrada 3-5 radnih dana"}
          className="admin-input"
        />
      </Field>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-5 bg-black/[0.02]">
        <ImageUploader
          label="Slike"
          helpText="Sve slike kroz koje se posjetitelj lista u pop-up prozoru proizvoda."
          multiple
          value={values.images}
          onChange={(urls) => set("images", urls)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="published"
          checked={values.published}
          onChange={(e) => set("published", e.target.checked)}
        />
        Objavljeno (vidljivo u PROIZVODI popisu na stranici)
      </label>

      {/* Skriveno polje koje server action očekuje kao string */}
      <input type="hidden" name="images" value={JSON.stringify(values.images)} />

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
