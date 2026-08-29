"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { Study } from "@/lib/db/schema";
import ImageUploader from "./ImageUploader";

type StudyAction = (
  prevState: ActionState,
  formData: FormData
) => ActionState | Promise<ActionState>;

type FormValues = {
  title: string;
  category: string;
  tagline: string;
  description: string;
  year: string;
  images: string[];
  externalUrl: string;
  published: boolean;
  position: string;
};

function initialValues(study?: Study): FormValues {
  return {
    title: study?.title ?? "",
    category: study?.category ?? "",
    tagline: study?.tagline ?? "",
    description: study?.description ?? "",
    year: String(study?.year ?? new Date().getFullYear()),
    images: study?.images ?? [],
    externalUrl: study?.externalUrl ?? "",
    published: study?.published ?? true,
    position: String(study?.position ?? 0),
  };
}

// Polja su KONTROLIRANA (React state) iz istog razloga kao u PropertyForm —
// nakon svakog izvršavanja server akcije <form> se resetira na native razini.
export default function StudyForm({
  study,
  action,
  submitLabel,
}: {
  study?: Study;
  action: StudyAction;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined
  );
  const [values, setValues] = useState<FormValues>(() => initialValues(study));

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Naslov">
          <input
            name="title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            required
            placeholder="npr. Rebrand kavane Kut"
            className="admin-input"
          />
        </Field>
        <Field label="Kategorija (prikazana u STUDIES popisu)">
          <input
            name="category"
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            required
            placeholder="npr. Brend identitet"
            className="admin-input"
          />
        </Field>
      </div>

      <Field label="Kratki slogan">
        <input
          name="tagline"
          value={values.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          required
          className="admin-input"
        />
      </Field>

      <Field label="Opis (prikazuje se u pop-up prozoru)">
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
        <Field label="Godina">
          <input
            name="year"
            type="number"
            min={1900}
            max={2100}
            value={values.year}
            onChange={(e) => set("year", e.target.value)}
            required
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

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-5 bg-black/[0.02]">
        <ImageUploader
          label="Slike"
          helpText="Sve slike kroz koje se posjetitelj lista u pop-up prozoru."
          multiple
          value={values.images}
          onChange={(urls) => set("images", urls)}
        />
      </div>

      <Field label="Vanjska poveznica (opcionalno)">
        <input
          name="externalUrl"
          type="url"
          value={values.externalUrl}
          onChange={(e) => set("externalUrl", e.target.value)}
          placeholder="https://…"
          className="admin-input"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="published"
          checked={values.published}
          onChange={(e) => set("published", e.target.checked)}
        />
        Objavljeno (vidljivo na stranici)
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
