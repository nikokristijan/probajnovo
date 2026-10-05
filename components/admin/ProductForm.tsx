"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { FaqItem, Product, QuantityDiscount, Testimonial } from "@/lib/db/schema";
import { FaqEditor, TestimonialsEditor } from "./CompanyForm";
import ImageUploader from "./ImageUploader";
import VideoUploader from "./VideoUploader";
import { Field } from "./Field";

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
  slug: string;
  videoUrl: string;
  category: string;
  featured: boolean;
  ctaButtonText: string;
  seoTitle: string;
  seoDescription: string;
  faq: FaqItem[];
  testimonials: Testimonial[];
  quantityDiscounts: QuantityDiscount[];
  addonProductIds: number[];
  addonDiscountPercent: string;
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
    slug: product?.slug ?? "",
    videoUrl: product?.videoUrl ?? "",
    category: product?.category ?? "",
    featured: product?.featured ?? false,
    ctaButtonText: product?.ctaButtonText ?? "",
    seoTitle: product?.seoTitle ?? "",
    seoDescription: product?.seoDescription ?? "",
    faq: product?.faq ?? [],
    testimonials: product?.testimonials ?? [],
    quantityDiscounts: product?.quantityDiscounts ?? [],
    addonProductIds: product?.addonProductIds ?? [],
    addonDiscountPercent: String(product?.addonDiscountPercent ?? 0),
  };
}

// Polja su KONTROLIRANA (React state) jer se <form> resetira nakon svakog
// izvršavanja server akcije (isti razlog kao u PropertyForm/StudyForm).
export default function ProductForm({
  product,
  action,
  submitLabel,
  otherProducts = [],
}: {
  product?: Product;
  action: ProductAction;
  submitLabel: string;
  /** Ostali proizvodi koje se može ponuditi kao dodatak uz ovaj. */
  otherProducts?: { id: number; name: string; priceEur: number | null }[];
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

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-5 bg-black/[0.02]">
        <p className="text-sm font-semibold">Vlastita stranica proizvoda</p>
        <Field label="Adresa — probajnovo.com/proizvodi/<slug> (prazno = proizvod nema vlastitu stranicu)">
          <input
            name="slug"
            value={values.slug}
            onChange={(e) => set("slug", e.target.value.toLowerCase())}
            pattern="[a-z0-9-]+"
            placeholder="npr. nfc-plocica-wifi"
            className="admin-input"
          />
        </Field>
        <VideoUploader
          label="Video (opcionalno)"
          helpText="Kratka snimka proizvoda u upotrebi — prikazuje se na vrhu stranice proizvoda i sama se vrti bez zvuka. Najbolje uspravna snimka s mobitela, 5–15 sekundi, MP4 do 10 MB."
          value={values.videoUrl}
          onChange={(url) => set("videoUrl", url)}
        />
        <input type="hidden" name="videoUrl" value={values.videoUrl} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kategorija / oznaka (opcionalno)">
            <input
              name="category"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="npr. NFC"
              className="admin-input"
            />
          </Field>
          <Field label="Tekst gumba za upit (prazno = 'Pošalji upit')">
            <input
              name="ctaButtonText"
              value={values.ctaButtonText}
              onChange={(e) => set("ctaButtonText", e.target.value)}
              placeholder="npr. Naruči pločicu"
              className="admin-input"
            />
          </Field>
        </div>
        <Field label="SEO naslov (prazno = naziv proizvoda)">
          <input
            name="seoTitle"
            value={values.seoTitle}
            onChange={(e) => set("seoTitle", e.target.value)}
            className="admin-input"
          />
        </Field>
        <Field label="SEO opis (prazno = kratki opis)">
          <textarea
            name="seoDescription"
            value={values.seoDescription}
            onChange={(e) => set("seoDescription", e.target.value)}
            rows={2}
            className="admin-input"
          />
        </Field>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <p className="text-sm font-semibold">Količinski popust</p>
        <p className="text-xs text-black/50 -mt-2">
          Npr. od 3 kom &minus;10 %, od 5 kom &minus;15 %. Kupac odmah vidi uštedu uz odabir količine, a iznos u upitu je već
          umanjen. Prazno = bez popusta.
        </p>
        <DiscountEditor value={values.quantityDiscounts} onChange={(v) => set("quantityDiscounts", v)} />
      </div>

      {otherProducts.length > 0 && (
        <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-3 bg-black/[0.02]">
          <p className="text-sm font-semibold">Paket: ponudi uz ovaj proizvod</p>
          <p className="text-xs text-black/50 -mt-1">
            Označeni proizvodi pojavljuju se u obrascu kao &bdquo;Dodajte uz narudžbu&ldquo; i ulaze u isti upit i iznos.
          </p>
          {otherProducts.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.addonProductIds.includes(p.id)}
                onChange={(e) =>
                  set(
                    "addonProductIds",
                    e.target.checked
                      ? [...values.addonProductIds, p.id]
                      : values.addonProductIds.filter((x) => x !== p.id)
                  )
                }
              />
              {p.name}
              {p.priceEur != null && <span className="text-black/40">· od {p.priceEur} €</span>}
            </label>
          ))}
          <Field label="Popust na dodatke kad se uzmu u paketu (%) — 0 = bez popusta">
            <input
              name="addonDiscountPercent"
              type="number"
              min={0}
              max={90}
              value={values.addonDiscountPercent}
              onChange={(e) => set("addonDiscountPercent", e.target.value)}
              className="admin-input max-w-[160px]"
            />
          </Field>
        </div>
      )}

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <p className="text-sm font-semibold">Recenzije kupaca</p>
        <p className="text-xs text-black/50 -mt-2">
          Samo stvarne recenzije (npr. iz poruka ili Googlea) — uz ime i mjesto/objekt, ako kupac pristane. Prikazuju se ispod
          cijene i u posebnoj sekciji. Prazno = ništa se ne prikazuje.
        </p>
        <TestimonialsEditor value={values.testimonials} onChange={(v) => set("testimonials", v)} />
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <p className="text-sm font-semibold">Česta pitanja</p>
        <p className="text-xs text-black/50 -mt-2">
          Odgovori na ono što kupce koči (npr. &bdquo;Radi li sa svim mobitelima?&ldquo;, &bdquo;Što ako promijenim WiFi
          lozinku?&ldquo;, &bdquo;Koliko traje izrada?&ldquo;). Prikazuju se iznad obrasca za upit i u Google rezultatima.
        </p>
        <FaqEditor value={values.faq} onChange={(v) => set("faq", v)} />
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

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="featured"
          checked={values.featured}
          onChange={(e) => set("featured", e.target.checked)}
        />
        Istaknuto (badge u popisu proizvoda)
      </label>

      {/* Skriveno polje koje server action očekuje kao string */}
      <input type="hidden" name="images" value={JSON.stringify(values.images)} />
      <input type="hidden" name="faq" value={JSON.stringify(values.faq)} />
      <input type="hidden" name="testimonials" value={JSON.stringify(values.testimonials)} />
      <input type="hidden" name="quantityDiscounts" value={JSON.stringify(values.quantityDiscounts)} />
      <input type="hidden" name="addonProductIds" value={JSON.stringify(values.addonProductIds)} />
      {otherProducts.length === 0 && (
        <input type="hidden" name="addonDiscountPercent" value={values.addonDiscountPercent} />
      )}

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

function DiscountEditor({
  value,
  onChange,
}: {
  value: QuantityDiscount[];
  onChange: (v: QuantityDiscount[]) => void;
}) {
  function update(i: number, patch: Partial<QuantityDiscount>) {
    onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  return (
    <div className="flex flex-col gap-2">
      {value.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span>od</span>
          <input
            type="number"
            min={2}
            max={999}
            className="admin-input w-24"
            value={t.minQty}
            onChange={(e) => update(i, { minQty: Number(e.target.value) })}
            aria-label="Najmanja količina"
          />
          <span>kom &minus;</span>
          <input
            type="number"
            min={1}
            max={90}
            className="admin-input w-20"
            value={t.percent}
            onChange={(e) => update(i, { percent: Number(e.target.value) })}
            aria-label="Popust u postocima"
          />
          <span>%</span>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="admin-repeat-remove"
          >
            Ukloni
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const last = value[value.length - 1];
          onChange([...value, last ? { minQty: last.minQty + 2, percent: last.percent + 5 } : { minQty: 3, percent: 10 }]);
        }}
        className="admin-repeat-add self-start"
      >
        + Dodaj prag popusta
      </button>
    </div>
  );
}
