"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { Company, Testimonial, FaqItem, ServiceItem } from "@/lib/db/schema";
import ImageUploader from "./ImageUploader";
import ReviewsImporter from "./ReviewsImporter";

const APPLE_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Kamen", value: "#8f8272" },
  { label: "Noć", value: "#3d4a72" },
  { label: "Maslina", value: "#7c7a49" },
  { label: "Terakota", value: "#b5502e" },
];

type CompanyAction = (
  prevState: ActionState,
  formData: FormData
) => ActionState | Promise<ActionState>;

type FormValues = {
  name: string;
  slug: string;
  location: string;
  tagline: string;
  description: string;
  services: ServiceItem[];
  workingHours: string;
  phone: string;
  address: string;
  instagramUrl: string;
  facebookUrl: string;
  accentColor: string;
  images: string[];
  bannerImage: string;
  contactEmail: string;
  published: boolean;
  layoutStyle: "classic" | "editorial" | "raw" | "apple";
  darkMode: boolean;
  mapUrl: string;
  testimonials: Testimonial[];
  faq: FaqItem[];
  imageCategories: Record<string, string>;
  videoUrl: string;
  reviewBadges: string;
  faviconUrl: string;
  customDomain: string;
};

function initialValues(company?: Company): FormValues {
  return {
    name: company?.name ?? "",
    slug: company?.slug ?? "",
    location: company?.location ?? "",
    tagline: company?.tagline ?? "",
    description: company?.description ?? "",
    services: company?.services ?? [],
    workingHours: company?.workingHours ?? "",
    phone: company?.phone ?? "",
    address: company?.address ?? "",
    instagramUrl: company?.instagramUrl ?? "",
    facebookUrl: company?.facebookUrl ?? "",
    accentColor: company?.accentColor ?? "#b5502e",
    images: company?.images ?? [],
    bannerImage: company?.bannerImage ?? "",
    contactEmail: company?.contactEmail ?? "",
    published: company?.published ?? true,
    layoutStyle: (company?.layoutStyle as FormValues["layoutStyle"]) ?? "classic",
    darkMode: company?.darkMode ?? false,
    mapUrl: company?.mapUrl ?? "",
    testimonials: company?.testimonials ?? [],
    faq: company?.faq ?? [],
    imageCategories: company?.imageCategories ?? {},
    videoUrl: company?.videoUrl ?? "",
    reviewBadges: company?.reviewBadges?.join("\n") ?? "",
    faviconUrl: company?.faviconUrl ?? "",
    customDomain: company?.customDomain ?? "",
  };
}

export default function CompanyForm({
  company,
  action,
  submitLabel,
}: {
  company?: Company;
  action: CompanyAction;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const [values, setValues] = useState<FormValues>(() => initialValues(company));

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Naziv firme">
          <input
            name="name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            required
            className="admin-input"
          />
        </Field>
        <Field label="Adresa (slug) — probajnovo.vercel.app/…">
          <input
            name="slug"
            value={values.slug}
            onChange={(e) => set("slug", e.target.value)}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Samo mala slova, brojke i crtice (npr. obrt-marko)"
            placeholder="npr. obrt-marko"
            className="admin-input"
          />
        </Field>
      </div>

      <Field label="Lokacija (prikazana uz naziv)">
        <input
          name="location"
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
          required
          placeholder="npr. Slavonski Brod · Slavonija"
          className="admin-input"
        />
      </Field>

      <Field label="Kratki slogan">
        <input
          name="tagline"
          value={values.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          required
          className="admin-input"
        />
      </Field>

      <Field label="Opis (prikazuje se u više redaka)">
        <textarea
          name="description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          required
          rows={6}
          className="admin-input"
        />
      </Field>

      <Field label="Boja stranice (identitet firme)">
        <input
          name="accentColor"
          type="color"
          value={values.accentColor}
          onChange={(e) => set("accentColor", e.target.value)}
          className="admin-input h-[38px] p-1 w-32"
        />
      </Field>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Izgled stranice firme</span>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Layout">
            <select
              name="layoutStyle"
              value={values.layoutStyle}
              onChange={(e) => set("layoutStyle", e.target.value as FormValues["layoutStyle"])}
              className="admin-input"
            >
              <option value="classic">Classic — obiteljski, topao pečat i polaroidi</option>
              <option value="editorial">Editorial — magazinski, veliki naslovi</option>
              <option value="raw">Raw — brutalist, mono, oštro</option>
              <option value="apple">Apple — stakleno, mekano, minimalno</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium mt-auto pb-2">
            <input
              type="checkbox"
              name="darkMode"
              checked={values.darkMode}
              onChange={(e) => set("darkMode", e.target.checked)}
            />
            Tamna varijanta boja
          </label>
        </div>

        {values.layoutStyle === "apple" && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              Boja pozadine za Apple stil — nekoliko prigušenih tonova (klikni za primjenu na &quot;Boja stranice&quot; gore)
            </span>
            <div className="flex flex-wrap gap-2">
              {APPLE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => set("accentColor", preset.value)}
                  className="flex items-center gap-2 rounded-full border border-black/15 bg-white pl-1.5 pr-3 py-1.5 text-xs font-medium hover:border-black/30"
                  title={preset.value}
                >
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: preset.value }} />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Usluge / proizvodi</span>
        <span className="text-xs text-black/50">
          Cijena je opcionalna — ostavi prazno da se prikaže &quot;na upit&quot;.
        </span>
        <ServicesEditor value={values.services} onChange={(v) => set("services", v)} />
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Radno vrijeme (opcionalno)</span>
        <Field label="Jedan redak po danu/grupi, npr. „Pon–Pet: 8–16“">
          <textarea
            name="workingHours"
            value={values.workingHours}
            onChange={(e) => set("workingHours", e.target.value)}
            rows={4}
            placeholder={"Pon–Pet: 8:00–16:00\nSubota: 8:00–12:00\nNedjelja: zatvoreno"}
            className="admin-input"
          />
        </Field>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Kontakt i lokacija</span>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Telefon (opcionalno)">
            <input
              name="phone"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+385 91 234 5678"
              className="admin-input"
            />
          </Field>
          <Field label="Kontakt email za ovu firmu (opcionalno)">
            <input
              name="contactEmail"
              type="email"
              value={values.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
              placeholder="Ostavi prazno za zadani email agencije"
              className="admin-input"
            />
          </Field>
        </div>
        <Field label="Adresa (opcionalno)">
          <input
            name="address"
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="npr. Ulica bana Josipa Jelačića 1, Slavonski Brod"
            className="admin-input"
          />
        </Field>
        <Field label="Poveznica na mapu (Google Maps i sl., opcionalno)">
          <input
            name="mapUrl"
            value={values.mapUrl}
            onChange={(e) => set("mapUrl", e.target.value)}
            placeholder="https://maps.google.com/…"
            className="admin-input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Instagram (opcionalno)">
            <input
              name="instagramUrl"
              value={values.instagramUrl}
              onChange={(e) => set("instagramUrl", e.target.value)}
              placeholder="https://instagram.com/…"
              className="admin-input"
            />
          </Field>
          <Field label="Facebook (opcionalno)">
            <input
              name="facebookUrl"
              value={values.facebookUrl}
              onChange={(e) => set("facebookUrl", e.target.value)}
              placeholder="https://facebook.com/…"
              className="admin-input"
            />
          </Field>
        </div>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-5 bg-black/[0.02]">
        <ImageUploader
          label="Banner slika"
          helpText="Prikazuje se na vrhu stranice firme."
          value={values.bannerImage ? [values.bannerImage] : []}
          onChange={(urls) => set("bannerImage", urls[0] ?? "")}
        />
        <ImageUploader
          label="Galerija slika"
          helpText="Sve slike koje posjetitelj može listati u pop-up prozoru projekta."
          multiple
          value={values.images}
          onChange={(urls) => {
            set("images", urls);
            const next: Record<string, string> = {};
            for (const url of urls) if (values.imageCategories[url]) next[url] = values.imageCategories[url];
            set("imageCategories", next);
          }}
        />
        <ImageCategoriesEditor
          images={values.images}
          value={values.imageCategories}
          onChange={(v) => set("imageCategories", v)}
        />
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Domena i favicon</span>
        <span className="text-xs text-black/50">
          Firma je uvijek dostupna na{" "}
          <span className="font-mono">probajnovo.vercel.app/{values.slug || "…"}</span>, a nakon
          jednokratnog povezivanja domene probajnovo.com i na{" "}
          <span className="font-mono">{(values.slug || "firma") + ".probajnovo.com"}</span> — bez
          ikakvog dodatnog koraka po firmi.
        </span>
        <ImageUploader
          label="Favicon (tab-ikona u pregledniku)"
          helpText="Bilo koja slika je OK — automatski se izreže na kvadrat i smanji. Ako ne uploadaš, koristi se NOVO logo."
          value={values.faviconUrl ? [values.faviconUrl] : []}
          onChange={(urls) => set("faviconUrl", urls[0] ?? "")}
          resizeToSquare={256}
        />
        <Field label="Vlastita domena (opcionalno, npr. tvrtka.com)">
          <input
            name="customDomain"
            value={values.customDomain}
            onChange={(e) => set("customDomain", e.target.value)}
            placeholder="tvrtka.com"
            className="admin-input"
          />
        </Field>
        <span className="text-xs text-black/50">
          Ovo polje samo bilježi da vlasnik želi svoju domenu — spremanje ovdje je ne aktivira
          automatski. Da bi zaživjela: vlasnik kod svog DNS registratora dodaje CNAME zapis koji
          pokazuje na <span className="font-mono">cname.vercel-dns.com</span>, a mi je zatim ručno
          dodamo u Vercel postavke projekta i povežemo s ovom firmom.
        </span>
      </div>

      <Field label="Poveznica na video (YouTube, Vimeo…, opcionalno)">
        <input
          name="videoUrl"
          value={values.videoUrl}
          onChange={(e) => set("videoUrl", e.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          className="admin-input"
        />
      </Field>

      <ReviewsImporter
        onImport={(parsed) => set("testimonials", [...values.testimonials, ...parsed])}
      />

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Recenzije klijenata (opcionalno)</span>
        <TestimonialsEditor value={values.testimonials} onChange={(v) => set("testimonials", v)} />
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Često postavljana pitanja (opcionalno)</span>
        <FaqEditor value={values.faq} onChange={(v) => set("faq", v)} />
      </div>

      <Field label="Oznake povjerenja — jedna po retku (opcionalno)">
        <textarea
          name="reviewBadges"
          value={values.reviewBadges}
          onChange={(e) => set("reviewBadges", e.target.value)}
          rows={3}
          placeholder={"4.9 na Google recenzijama\n50+ zadovoljnih klijenata"}
          className="admin-input"
        />
        <span className="text-xs text-black/50">Prikazuju se kao sitni chipovi pri vrhu stranice.</span>
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

      {/* Skrivena polja koja server action očekuje kao stringove */}
      <input type="hidden" name="images" value={JSON.stringify(values.images)} />
      <input type="hidden" name="bannerImage" value={values.bannerImage} />
      <input type="hidden" name="faviconUrl" value={values.faviconUrl} />
      <input type="hidden" name="services" value={JSON.stringify(values.services)} />
      <input type="hidden" name="testimonials" value={JSON.stringify(values.testimonials)} />
      <input type="hidden" name="faq" value={JSON.stringify(values.faq)} />
      <input type="hidden" name="imageCategories" value={JSON.stringify(values.imageCategories)} />

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

function ImageCategoriesEditor({
  images,
  value,
  onChange,
}: {
  images: string[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-black/50">
        Kategoriziraj slike galerije (opcionalno) — npr. Prostor, Tim, Radovi. Ostavi prazno da se
        galerija prikaže bez grupiranja.
      </span>
      <div className="flex flex-col gap-2">
        {images.map((url) => (
          <div key={url} className="flex items-center gap-2">
            <div className="w-11 h-11 rounded-lg overflow-hidden border border-black/10 bg-black/5 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
            <input
              className="admin-input"
              placeholder="npr. Prostor"
              value={value[url] ?? ""}
              onChange={(e) => onChange({ ...value, [url]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TestimonialsEditor({
  value,
  onChange,
}: {
  value: Testimonial[];
  onChange: (v: Testimonial[]) => void;
}) {
  function update(i: number, patch: Partial<Testimonial>) {
    onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  return (
    <div className="flex flex-col gap-3">
      {value.map((t, i) => (
        <div key={i} className="admin-repeat-row">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="admin-input"
              placeholder="Ime klijenta"
              value={t.author}
              onChange={(e) => update(i, { author: e.target.value })}
            />
            <select
              className="admin-input"
              value={t.rating}
              onChange={(e) => update(i, { rating: Number(e.target.value) })}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)}
                  {"☆".repeat(5 - n)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="admin-input"
            rows={2}
            placeholder="Citat klijenta"
            value={t.text}
            onChange={(e) => update(i, { text: e.target.value })}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="admin-repeat-remove"
          >
            Ukloni recenziju
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { author: "", text: "", rating: 5 }])}
        className="admin-repeat-add"
      >
        + Dodaj recenziju
      </button>
    </div>
  );
}

function FaqEditor({ value, onChange }: { value: FaqItem[]; onChange: (v: FaqItem[]) => void }) {
  function update(i: number, patch: Partial<FaqItem>) {
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  return (
    <div className="flex flex-col gap-3">
      {value.map((f, i) => (
        <div key={i} className="admin-repeat-row">
          <input
            className="admin-input"
            placeholder="Pitanje"
            value={f.question}
            onChange={(e) => update(i, { question: e.target.value })}
          />
          <textarea
            className="admin-input"
            rows={2}
            placeholder="Odgovor"
            value={f.answer}
            onChange={(e) => update(i, { answer: e.target.value })}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="admin-repeat-remove"
          >
            Ukloni pitanje
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { question: "", answer: "" }])}
        className="admin-repeat-add"
      >
        + Dodaj pitanje
      </button>
    </div>
  );
}

function ServicesEditor({
  value,
  onChange,
}: {
  value: ServiceItem[];
  onChange: (v: ServiceItem[]) => void;
}) {
  function update(i: number, patch: Partial<ServiceItem>) {
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  return (
    <div className="flex flex-col gap-3">
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
          <div className="flex flex-col gap-2">
            <input
              className="admin-input"
              placeholder="Naziv usluge/proizvoda"
              value={s.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              className="admin-input"
              placeholder="Kratki opis (opcionalno)"
              value={s.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </div>
          <input
            className="admin-input"
            type="number"
            min={0}
            placeholder="€ (opc.)"
            value={s.priceEur ?? ""}
            onChange={(e) => update(i, { priceEur: e.target.value === "" ? null : Number(e.target.value) })}
          />
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
        onClick={() => onChange([...value, { name: "", description: "", priceEur: null }])}
        className="admin-repeat-add self-start"
      >
        + Dodaj uslugu/proizvod
      </button>
    </div>
  );
}
