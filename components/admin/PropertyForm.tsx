"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";
import type { Property, Testimonial, FaqItem, SeasonalPrice } from "@/lib/db/schema";
import ImageUploader from "./ImageUploader";
import ReviewsImporter from "./ReviewsImporter";

/** Prigušeni, "tonalni" tonovi umjesto šarenog neona — Apple hero pozadina
    (radial gradient mesh u CSS-u) izvodi se iz accentColor, pa ovo samo
    ubrzava biranje boje koja tamo dobro izgleda. Nije novo polje u bazi. */
const APPLE_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Kamen", value: "#8f8272" },
  { label: "Noć", value: "#3d4a72" },
  { label: "Maslina", value: "#7c7a49" },
  { label: "Terakota", value: "#b5502e" },
];

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
  phone: string;
  published: boolean;
  showInStudies: boolean;
  layoutStyle: "classic" | "editorial" | "raw" | "apple";
  darkMode: boolean;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string;
  hostName: string;
  hostNote: string;
  hostPhoto: string;
  mapUrl: string;
  address: string;
  testimonials: Testimonial[];
  faq: FaqItem[];
  imageCategories: Record<string, string>;
  videoUrl: string;
  seasonalPricing: SeasonalPrice[];
  availabilityUrl: string;
  icalUrl: string;
  reviewBadges: string;
  faviconUrl: string;
  customDomain: string;
  logoUrl: string;
  showNovoBranding: boolean;
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
    phone: property?.phone ?? "",
    published: property?.published ?? true,
    showInStudies: property?.showInStudies ?? false,
    layoutStyle: (property?.layoutStyle as FormValues["layoutStyle"]) ?? "classic",
    darkMode: property?.darkMode ?? false,
    checkInTime: property?.checkInTime ?? "",
    checkOutTime: property?.checkOutTime ?? "",
    houseRules: property?.houseRules?.join("\n") ?? "",
    hostName: property?.hostName ?? "",
    hostNote: property?.hostNote ?? "",
    hostPhoto: property?.hostPhoto ?? "",
    mapUrl: property?.mapUrl ?? "",
    address: property?.address ?? "",
    testimonials: property?.testimonials ?? [],
    faq: property?.faq ?? [],
    imageCategories: property?.imageCategories ?? {},
    videoUrl: property?.videoUrl ?? "",
    seasonalPricing: property?.seasonalPricing ?? [],
    availabilityUrl: property?.availabilityUrl ?? "",
    icalUrl: property?.icalUrl ?? "",
    reviewBadges: property?.reviewBadges?.join("\n") ?? "",
    faviconUrl: property?.faviconUrl ?? "",
    customDomain: property?.customDomain ?? "",
    logoUrl: property?.logoUrl ?? "",
    showNovoBranding: property?.showNovoBranding ?? true,
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
  initialWarning,
}: {
  property?: Property;
  action: PropertyAction;
  submitLabel: string;
  /** Upozorenje o kartu koje dolazi s URL-a (?geo=miss) nakon kreiranja nove
   *  vikendice — vidi createPropertyAction. Prikazano dok se forma prvi put
   *  ne pošalje, nakon čega preuzima state.warning (isti mehanizam za
   *  update). */
  initialWarning?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined
  );
  const warning = state ? state.warning : initialWarning;
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
        <Field label="Adresa (slug) — probajnovo.vercel.app/…">
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
        <span className="text-xs text-black/50">
          Prepoznate riječi (wifi, parking, bazen, kamin, klima, tv, kuhinja, roštilj, vrt,
          ljubimci, perilica…) automatski dobiju ikonu na stranici.
        </span>
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
                  <span
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ background: preset.value }}
                  />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
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
        <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
          <ImageUploader
            label="Fotografija domaćina"
            value={values.hostPhoto ? [values.hostPhoto] : []}
            onChange={(urls) => set("hostPhoto", urls[0] ?? "")}
          />
          <div className="flex flex-col gap-4">
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
          </div>
        </div>
        <Field label="Adresa (za automatsku kartu na stranici)">
          <input
            name="address"
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="npr. Bukovlje 45, Slavonski Brod"
            className="admin-input"
          />
          <p className="text-xs text-black/50 mt-1">
            Unesi punu adresu i stranica će automatski prikazati ugrađenu kartu (OpenStreetMap,
            besplatno) — ne treba ništa ručno tražiti/kopirati.
          </p>
        </Field>
        <Field label="Poveznica na mapu (opcionalno)">
          <input
            name="mapUrl"
            value={values.mapUrl}
            onChange={(e) => set("mapUrl", e.target.value)}
            placeholder="https://maps.google.com/…"
            className="admin-input"
          />
          <p className="text-xs text-black/50 mt-1">
            Koristi se za gumb &quot;Otvori na karti&quot;. Ostavi prazno i, ako je adresa
            popunjena, automatski se koristi OpenStreetMap poveznica.
          </p>
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
          onChange={(urls) => {
            set("images", urls);
            // ukloni kategorije obrisanih slika da se ne gomilaju u JSON-u
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
          Vikendica je uvijek dostupna na{" "}
          <span className="font-mono">probajnovo.vercel.app/{values.slug || "…"}</span>, a nakon
          jednokratnog povezivanja domene probajnovo.com i na{" "}
          <span className="font-mono">{(values.slug || "vila") + ".probajnovo.com"}</span> — bez
          ikakvog dodatnog koraka po vikendici.
        </span>
        <ImageUploader
          label="Favicon (tab-ikona u pregledniku)"
          helpText="Bilo koja slika je OK — automatski se izreže na kvadrat i smanji. Ako ne uploadaš, koristi se NOVO logo."
          value={values.faviconUrl ? [values.faviconUrl] : []}
          onChange={(urls) => set("faviconUrl", urls[0] ?? "")}
          resizeToSquare={256}
        />
        <Field label="Vlastita domena (opcionalno, npr. vila-marija.com)">
          <input
            name="customDomain"
            value={values.customDomain}
            onChange={(e) => set("customDomain", e.target.value)}
            placeholder="vila-marija.com"
            className="admin-input"
          />
        </Field>
        <span className="text-xs text-black/50">
          Ovo polje samo bilježi da vlasnik želi svoju domenu — spremanje ovdje je ne aktivira
          automatski. Da bi zaživjela: vlasnik kod svog DNS registratora dodaje CNAME zapis koji
          pokazuje na <span className="font-mono">cname.vercel-dns.com</span>, a mi je zatim ručno
          dodamo u Vercel postavke projekta i povežemo s ovom vikendicom.
        </span>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Brendiranje (gornji lijevi kut stranice)</span>
        <span className="text-xs text-black/50">
          Ovisi o paketu koji je vlasnik kupio: ako paket uključuje uklanjanje NOVO brendiranja,
          isključi kvačicu ispod. Ako uploadaš vlasnikov logo, on se prikazuje UMJESTO &quot;NOVO&quot;
          naziva bez obzira na kvačicu (logo uvijek ima prednost).
        </span>
        <ImageUploader
          label="Klijentov logo (opcionalno)"
          helpText="Prikazuje se u gornjem lijevom kutu umjesto NOVO naziva. Ostavi prazno ako klijent nema svoj logo."
          value={values.logoUrl ? [values.logoUrl] : []}
          onChange={(urls) => set("logoUrl", urls[0] ?? "")}
        />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="showNovoBranding"
            checked={values.showNovoBranding}
            onChange={(e) => set("showNovoBranding", e.target.checked)}
          />
          Prikaži &quot;NOVO&quot; naziv u gornjem lijevom kutu (kad nema klijentovog logotipa)
        </label>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Video / virtualna šetnja i dostupnost</span>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Poveznica na video (YouTube, Vimeo…, opcionalno)">
            <input
              name="videoUrl"
              value={values.videoUrl}
              onChange={(e) => set("videoUrl", e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="admin-input"
            />
          </Field>
          <Field label="Poveznica na kalendar dostupnosti (opcionalno)">
            <input
              name="availabilityUrl"
              value={values.availabilityUrl}
              onChange={(e) => set("availabilityUrl", e.target.value)}
              placeholder="https://booking.com/…"
              className="admin-input"
            />
          </Field>
        </div>
        <Field label="iCal poveznica za automatski kalendar (opcionalno)">
          <input
            name="icalUrl"
            value={values.icalUrl}
            onChange={(e) => set("icalUrl", e.target.value)}
            placeholder="https://www.airbnb.com/calendar/ical/….ics"
            className="admin-input"
          />
          <p className="text-xs text-black/50 mt-1">
            &bdquo;Export Calendar&rdquo; link iz Booking.com/Airbnb oglasa (ako ga vikendica ima) — jednom
            dnevno automatski povlačimo zauzete datume u kalendar (/admin/kalendar), ne treba ih
            ručno unositi.
          </p>
        </Field>
      </div>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Sezonski cjenik (opcionalno)</span>
        <span className="text-xs text-black/50">
          Ako dodaš barem jedan red, na stranici se prikazuje tablica cijena po sezoni umjesto
          jedne fiksne cijene.
        </span>
        <SeasonalPricingEditor
          value={values.seasonalPricing}
          onChange={(v) => set("seasonalPricing", v)}
        />
      </div>

      <ReviewsImporter
        onImport={(parsed) => set("testimonials", [...values.testimonials, ...parsed])}
      />

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Recenzije gostiju (opcionalno)</span>
        <TestimonialsEditor
          value={values.testimonials}
          onChange={(v) => set("testimonials", v)}
          propertyName={values.name}
        />
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
          placeholder={"4.9 na Google recenzijama\n50+ zadovoljnih gostiju\nSuperhost 2025"}
          className="admin-input"
        />
        <span className="text-xs text-black/50">Prikazuju se kao sitni chipovi pri vrhu stranice.</span>
      </Field>

      <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
        <span className="text-sm font-semibold">Kontakt vlasnika</span>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email vlasnika za ovu vikendicu (opcionalno)">
            <input
              name="contactEmail"
              type="email"
              value={values.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
              placeholder="Ostavi prazno za zadani email agencije"
              className="admin-input"
            />
          </Field>
          <Field label="Telefon vlasnika (opcionalno)">
            <input
              name="phone"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+385 91 234 5678"
              className="admin-input"
            />
          </Field>
        </div>
        <span className="text-xs text-black/50">
          Email gore prima i &quot;Kontaktirajte nas&quot; upite i automatsku obavijest o svakom
          novom upitu s ove stranice — nije potrebno posebno polje za to. Telefon uključuje
          &quot;Nazovite&quot; i WhatsApp gumb na stranici vikendice (ostaje skriven dok ga ne
          upišeš).
        </span>
      </div>

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
      <input type="hidden" name="hostPhoto" value={values.hostPhoto} />
      <input type="hidden" name="faviconUrl" value={values.faviconUrl} />
      <input type="hidden" name="logoUrl" value={values.logoUrl} />
      <input type="hidden" name="testimonials" value={JSON.stringify(values.testimonials)} />
      <input type="hidden" name="faq" value={JSON.stringify(values.faq)} />
      <input type="hidden" name="imageCategories" value={JSON.stringify(values.imageCategories)} />
      <input type="hidden" name="seasonalPricing" value={JSON.stringify(values.seasonalPricing)} />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Spremljeno.</p>}
      {warning && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {warning}
        </p>
      )}

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
        Kategoriziraj slike galerije (opcionalno) — npr. Eksterijer, Interijer, Okolica. Ostavi
        prazno da se galerija prikaže bez grupiranja.
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
              placeholder="npr. Interijer"
              value={value[url] ?? ""}
              onChange={(e) => onChange({ ...value, [url]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Kopiraj za Instagram" — formatira recenziju kao gotov Instagram caption
    (citat + zvijezdice + ime + hashtagovi) i kopira u međuspremnik, bez
    stvarnog auto-objavljivanja (nema Instagram API integracije). */
function instagramCaption(t: Testimonial, propertyName: string): string {
  const stars = "⭐".repeat(Math.max(1, Math.min(5, t.rating)));
  return `${stars}\n\n"${t.text}"\n\n— ${t.author || "Gost"}, ${propertyName}\n\n#${propertyName.replace(/\s+/g, "")} #vikendica #odmor`;
}

function TestimonialsEditor({
  value,
  onChange,
  propertyName,
}: {
  value: Testimonial[];
  onChange: (v: Testimonial[]) => void;
  propertyName: string;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  function update(i: number, patch: Partial<Testimonial>) {
    onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  async function copyForInstagram(i: number, t: Testimonial) {
    try {
      await navigator.clipboard.writeText(instagramCaption(t, propertyName || "vikendica"));
      setCopiedIndex(i);
      setTimeout(() => setCopiedIndex((cur) => (cur === i ? null : cur)), 2000);
    } catch {
      // Clipboard API može biti nedostupan (npr. bez HTTPS-a lokalno) — tiho
      // ne radi ništa, admin može ručno kopirati tekst iz textarea.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((t, i) => (
        <div key={i} className="admin-repeat-row">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="admin-input"
              placeholder="Ime gosta"
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
            placeholder="Citat gosta"
            value={t.text}
            onChange={(e) => update(i, { text: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => copyForInstagram(i, t)} className="admin-repeat-add">
              {copiedIndex === i ? "Kopirano!" : "Kopiraj za Instagram"}
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="admin-repeat-remove"
            >
              Ukloni recenziju
            </button>
          </div>
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

function SeasonalPricingEditor({
  value,
  onChange,
}: {
  value: SeasonalPrice[];
  onChange: (v: SeasonalPrice[]) => void;
}) {
  function update(i: number, patch: Partial<SeasonalPrice>) {
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  return (
    <div className="flex flex-col gap-3">
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
          <input
            className="admin-input"
            placeholder="npr. Ljetna sezona (lipanj–rujan)"
            value={s.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            className="admin-input"
            type="number"
            min={0}
            placeholder="EUR / noć"
            value={s.priceEur}
            onChange={(e) => update(i, { priceEur: Number(e.target.value) })}
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
        onClick={() => onChange([...value, { label: "", priceEur: 0 }])}
        className="admin-repeat-add self-start"
      >
        + Dodaj sezonu
      </button>
    </div>
  );
}
