"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { Property } from "@/lib/db/schema";
import ImageUploader from "./ImageUploader";

type PropertyAction = (
  prevState: ActionState,
  formData: FormData
) => ActionState | Promise<ActionState>;

type FormValues = {
  name: string;
  slug: string;
  location: string;
  tagline: string;
  description: string;
  amenities: string;
  priceFromEur: string;
  capacityGuests: string;
  bedrooms: string;
  distanceFromCenter: string;
  accentColor: string;
  images: string[];
  bannerImage: string;
  contactEmail: string;
  published: boolean;
  showInStudies: boolean;
  layoutStyle: "classic" | "editorial" | "raw";
  darkMode: boolean;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string;
  hostName: string;
  hostNote: string;
  mapUrl: string;
};

function initialValues(property?: Property): FormValues {
  return {
    name: property?.name ?? "",
    slug: property?.slug ?? "",
    location: property?.location ?? "",
    tagline: property?.tagline ?? "",
    description: property?.description ?? "",
    amenities: property?.amenities?.join("\n") ?? "",
    priceFromEur: String(property?.priceFromEur ?? 60),
    capacityGuests: String(property?.capacityGuests ?? 4),
    bedrooms: String(property?.bedrooms ?? 2),
    distanceFromCenter: property?.distanceFromCenter ?? "",
    accentColor: property?.accentColor ?? "#b5502e",
    images: property?.images ?? [],
    bannerImage: property?.bannerImage ?? "",
    contactEmail: property?.contactEmail ?? "",
    published: property?.published ?? true,
    showInStudies: property?.showInStudies ?? false,
    layoutStyle: (property?.layoutStyle as FormValues["layoutStyle"]) ?? "classic",
    darkMode: property?.darkMode ?? false,
    checkInTime: property?.checkInTime ?? "",
    checkOutTime: property?.checkOutTime ?? "",
    houseRules: property?.houseRules?.join("\n") ?? "",
    hostName: property?.hostName ?? "",
    hostNote: property?.hostNote ?? "",
    mapUrl: property?.mapUrl ?? "",
  };
}

// Polja su KONTROLIRANA (React state), ne oslanjamo se na defaultValue —
// React nakon svakog izvršavanja server akcije (uspješne ili neuspješne)
// resetira <form> na native razini, pa bi se defaultValue polja inače
// ispraznila kad admin ispravlja samo jednu grešku i ponovno šalje formu.
export default function PropertyForm({
  property,
  action,
  submitLabel,
}: {
  property?: Property;
  action: PropertyAction;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined
  );
  const [values, setValues] = useState<FormValues>(() => initialValues(property));

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Naziv vikendice">
          <input
            name="name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            required
            className="admin-input"
          />
        </Field>
        <Field label="Adresa (slug) — novo.hr/…">
          <input
            name="slug"
            value={values.slug}
            onChange={(e) => set("slug", e.target.value)}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Samo mala slova, brojke i crtice (npr. sokak-bez-imena)"
            placeholder="npr. sokak-bez-imena"
            className="admin-input"
          />
        </Field>
      </div>

      <Field label="Lokacija (prikazana na stranici)">
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

      <Field label="Sadržaji — jedan po retku">
        <textarea
          name="amenities"
          value={values.amenities}
          onChange={(e) => set("amenities", e.target.value)}
          rows={6}
          placeholder={"Besplatan WiFi\nParking na posjedu\nVrt s roštiljem"}
          className="admin-input"
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Cijena od (EUR / noć)">
          <input
            name="priceFromEur"
            type="number"
            min={0}
            value={values.priceFromEur}
            onChange={(e) => set("priceFromEur", e.target.value)}
            required
            className="admin-input"
          />
        </Field>
        <Field label="Broj gostiju">
          <input
            name="capacityGuests"
            type="number"
            min={1}
            value={values.capacityGuests}
            onChange={(e) => set("capacityGuests", e.target.value)}
            required
            className="admin-input"
          />
        </Field>
        <Field label="Spavaće sobe">
          <input
            name="bedrooms"
            type="number"
            min={0}
            value={values.bedrooms}
            onChange={(e) => set("bedrooms", e.target.value)}
            required
            className="admin-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Udaljenost od centra (tekst)">
          <input
            name="distanceFromCenter"
            value={values.distanceFromCenter}
            onChange={(e) => set("distanceFromCenter", e.target.value)}
            required
            placeholder="npr. 1,2 km od centra"
            className="admin-input"
          />
        </Field>
        <Field label="Boja stranice (identitet vikendice)">
          <input
            name="accentColor"
            type="color"
            value={values.accentColor}
            onChange={(e) => set("accentColor", e.target.value)}
            className="admin-input h-[38px] p-1"
          />
        </Field>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Izgled stranice vikendice</span>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Layout">
            <select
              name="layoutStyle"
              value={values.layoutStyle}
              onChange={(e) => set("layoutStyle", e.target.value as FormValues["layoutStyle"])}
              className="admin-input"
            >
              <option value="classic">Classic — čisto, uravnoteženo</option>
              <option value="editorial">Editorial — magazinski, veliki naslovi</option>
              <option value="raw">Raw — brutalist, mono, oštro</option>
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
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="showInStudies"
            checked={values.showInStudies}
            onChange={(e) => set("showInStudies", e.target.checked)}
          />
          Prikaži i u STUDIES popisu na naslovnici
        </label>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Prijava, odjava i kućni red</span>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prijava (check-in)">
            <input
              name="checkInTime"
              value={values.checkInTime}
              onChange={(e) => set("checkInTime", e.target.value)}
              placeholder="npr. od 15:00"
              className="admin-input"
            />
          </Field>
          <Field label="Odjava (check-out)">
            <input
              name="checkOutTime"
              value={values.checkOutTime}
              onChange={(e) => set("checkOutTime", e.target.value)}
              placeholder="npr. do 10:00"
              className="admin-input"
            />
          </Field>
        </div>
        <Field label="Kućni red — jedan po retku">
          <textarea
            name="houseRules"
            value={values.houseRules}
            onChange={(e) => set("houseRules", e.target.value)}
            rows={4}
            placeholder={"Nema pušenja u kući\nTiha noć od 22h\nKućni ljubimci uz najavu"}
            className="admin-input"
          />
        </Field>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Domaćin (opcionalno, osobniji dojam)</span>
        <Field label="Ime domaćina">
          <input
            name="hostName"
            value={values.hostName}
            onChange={(e) => set("hostName", e.target.value)}
            placeholder="npr. Ana"
            className="admin-input"
          />
        </Field>
        <Field label="Osobna poruka gostima">
          <textarea
            name="hostNote"
            value={values.hostNote}
            onChange={(e) => set("hostNote", e.target.value)}
            rows={3}
            placeholder="npr. Javite se ako vam treba bilo što — javljam se brzo!"
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
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-5 bg-black/[0.02]">
        <ImageUploader
          label="Banner slika"
          helpText="Prikazuje se na vrhu stranice vikendice i u pop-up prozoru na početnoj."
          value={values.bannerImage ? [values.bannerImage] : []}
          onChange={(urls) => set("bannerImage", urls[0] ?? "")}
        />
        <ImageUploader
          label="Galerija slika"
          helpText="Sve slike koje posjetitelj može listati u pop-up prozoru projekta."
          multiple
          value={values.images}
          onChange={(urls) => set("images", urls)}
        />
      </div>

      <Field label="Kontakt email za ovu vikendicu (opcionalno)">
        <input
          name="contactEmail"
          type="email"
          value={values.contactEmail}
          onChange={(e) => set("contactEmail", e.target.value)}
          placeholder="Ostavi prazno za zadani email agencije"
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

      {/* Skrivena polja koja server action očekuje kao stringove */}
      <input type="hidden" name="images" value={JSON.stringify(values.images)} />
      <input type="hidden" name="bannerImage" value={values.bannerImage} />

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
