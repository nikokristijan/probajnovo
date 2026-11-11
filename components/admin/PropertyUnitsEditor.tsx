"use client";

import { useActionState, useState } from "react";
import type { PropertyDestination, PropertyTexts, PropertyUnit } from "@/lib/db/units";
import type { SaveUnitsState } from "@/lib/actions-units";

type UnitDraft = {
  slug: string;
  name: string;
  label: string;
  labelEn: string;
  sizeM2: string;
  guests: string;
  bedrooms: string;
  bathrooms: string;
  description: string;
  descriptionEn: string;
  features: string;
  featuresEn: string;
  icalUrl: string;
};
type HighlightDraft = { title: string; titleEn: string; text: string; textEn: string };
type DestinationDraft = { title: string; titleEn: string; intro: string; introEn: string; highlights: HighlightDraft[] };

function toUnitDraft(u: PropertyUnit): UnitDraft {
  return {
    slug: u.slug,
    name: u.name,
    label: u.label ?? "",
    labelEn: u.labelEn ?? "",
    sizeM2: u.sizeM2 != null ? String(u.sizeM2) : "",
    guests: u.guests != null ? String(u.guests) : "",
    bedrooms: u.bedrooms != null ? String(u.bedrooms) : "",
    bathrooms: u.bathrooms,
    description: u.description,
    descriptionEn: u.descriptionEn,
    features: u.features.join("\n"),
    featuresEn: u.featuresEn.join("\n"),
    icalUrl: u.icalUrl,
  };
}

function emptyUnit(name = ""): UnitDraft {
  return {
    slug: "",
    name,
    label: "",
    labelEn: "",
    sizeM2: "",
    guests: "",
    bedrooms: "",
    bathrooms: "",
    description: "",
    descriptionEn: "",
    features: "",
    featuresEn: "",
    icalUrl: "",
  };
}

function toDestinationDraft(d: PropertyDestination | null): DestinationDraft {
  return {
    title: d?.title ?? "",
    titleEn: d?.titleEn ?? "",
    intro: d?.intro ?? "",
    introEn: d?.introEn ?? "",
    highlights: (d?.highlights ?? []).map((h) => ({ ...h })),
  };
}

const label = "flex flex-col gap-1 text-xs font-medium text-black/60";

/**
 * Admin → Uredi vikendicu: apartmani (zasebne podstranice s vlastitim
 * karakteristikama i kalendarom) + sekcija "Doživite <lokacija>".
 * Fotografije apartmana se povezuju preko "Kategoriziraj slike galerije"
 * u formi iznad: kategorija slike = TOČAN naziv apartmana. Slike s
 * kategorijom jednakom lokaciji (npr. "Lastovo") idu u sekciju "Doživite".
 */
export default function PropertyUnitsEditor({
  action,
  initialUnits,
  initialDestination,
  initialTexts,
  location,
  suggestedNames,
  slug,
}: {
  action: (prev: SaveUnitsState, formData: FormData) => Promise<SaveUnitsState>;
  initialUnits: PropertyUnit[];
  initialDestination: PropertyDestination | null;
  initialTexts?: PropertyTexts;
  location: string;
  suggestedNames: string[];
  slug: string;
}) {
  const [units, setUnits] = useState<UnitDraft[]>(() => initialUnits.map(toUnitDraft));
  const [dest, setDest] = useState<DestinationDraft>(() => toDestinationDraft(initialDestination));
  const [texts, setTexts] = useState(() => ({
    taglineEn: initialTexts?.taglineEn ?? "",
    descriptionEn: initialTexts?.descriptionEn ?? "",
    amenitiesEn: (initialTexts?.amenitiesEn ?? []).join("\n"),
    badgesEn: (initialTexts?.badgesEn ?? []).join("\n"),
    quote: initialTexts?.quote ?? "",
    quoteEn: initialTexts?.quoteEn ?? "",
    quoteBy: initialTexts?.quoteBy ?? "",
    quoteKicker: initialTexts?.quoteKicker ?? "",
  }));
  const [state, formAction, pending] = useActionState(action, null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const payload = JSON.stringify({
    units: units.map((u) => ({
      ...u,
      sizeM2: u.sizeM2,
      guests: u.guests,
      bedrooms: u.bedrooms,
      features: u.features.split("\n"),
      featuresEn: u.featuresEn.split("\n"),
    })),
    destination: dest,
    texts: { ...texts, amenitiesEn: texts.amenitiesEn.split("\n"), badgesEn: texts.badgesEn.split("\n") },
  });

  const setUnit = (i: number, patch: Partial<UnitDraft>) =>
    setUnits((list) => list.map((u, j) => (j === i ? { ...u, ...patch } : u)));
  const setHighlight = (i: number, patch: Partial<HighlightDraft>) =>
    setDest((d) => ({ ...d, highlights: d.highlights.map((h, j) => (j === i ? { ...h, ...patch } : h)) }));

  function importJson(text: string) {
    if (!text.trim()) {
      setJsonError(null);
      return;
    }
    try {
      const data = JSON.parse(text) as { units?: PropertyUnit[]; destination?: PropertyDestination | null };
      if (Array.isArray(data.units)) {
        setUnits(
          data.units.map((u) =>
            toUnitDraft({
              ...u,
              features: Array.isArray(u.features) ? u.features : [],
              featuresEn: Array.isArray(u.featuresEn) ? u.featuresEn : [],
              bathrooms: u.bathrooms ?? "",
              description: u.description ?? "",
              descriptionEn: u.descriptionEn ?? "",
              icalUrl: u.icalUrl ?? "",
              slug: u.slug ?? "",
              label: u.label ?? "",
              labelEn: u.labelEn ?? "",
            })
          )
        );
      }
      if (data.destination !== undefined) setDest(toDestinationDraft(data.destination));
      setJsonError(null);
    } catch {
      setJsonError("JSON nije ispravan.");
    }
  }

  const missing = suggestedNames.filter((n) => !units.some((u) => u.name.trim().toLowerCase() === n.toLowerCase()));

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-6">
      <input type="hidden" name="payload" value={payload} />

      <section className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold">Apartmani (zasebne podstranice)</h2>
          <p className="text-xs text-black/55 mt-1 leading-relaxed">
            Svaki apartman dobiva svoju podstranicu ({slug}.probajnovo.com/<i>slug</i>), vlastite karakteristike i
            vlastiti kalendar (admin → Kalendar). Cijene se vuku iz sezonskog cjenika gore (naziv ispred zagrade =
            naziv apartmana), a fotografije iz &bdquo;Kategoriziraj slike galerije&ldquo; (kategorija = točan naziv
            apartmana).
          </p>
        </div>

        {units.map((u, i) => (
          <div key={i} className="border border-black/10 rounded-lg p-4 flex flex-col gap-3 bg-black/[0.015]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Apartman {i + 1}</span>
              <div className="flex gap-2">
                {i > 0 && (
                  <button
                    type="button"
                    className="text-xs underline text-black/60"
                    onClick={() => setUnits((l) => { const c = [...l]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}
                  >
                    ↑ gore
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs underline text-red-700"
                  onClick={() => setUnits((l) => l.filter((_, j) => j !== i))}
                >
                  Ukloni
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={label}>
                Naziv
                <input className="admin-input" value={u.name} onChange={(e) => setUnit(i, { name: e.target.value })} />
              </label>
              <label className={label}>
                Slug (URL) — prazno = automatski
                <input className="admin-input" value={u.slug} placeholder="apartman-1" onChange={(e) => setUnit(i, { slug: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={label}>
                Naziv za prikaz (HR) — prazno = Naziv
                <input className="admin-input" value={u.label} placeholder="npr. Duka & Piko apartmani 1" onChange={(e) => setUnit(i, { label: e.target.value })} />
              </label>
              <label className={label}>
                Naziv za prikaz (EN) — prazno = Naziv
                <input className="admin-input" value={u.labelEn} placeholder="npr. Duka & Piko Apartments 1" onChange={(e) => setUnit(i, { labelEn: e.target.value })} />
              </label>
            </div>
            <p className="text-xs text-black/50 -mt-1">„Naziv” povezuje apartman sa sezonskim cjenikom i kategorijom fotografija, pa ga ne mijenjajte bez potrebe — za drugačiji prikaz koristite polja iznad.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className={label}>
                Površina (m²)
                <input className="admin-input" inputMode="numeric" value={u.sizeM2} onChange={(e) => setUnit(i, { sizeM2: e.target.value })} />
              </label>
              <label className={label}>
                Gostiju
                <input className="admin-input" inputMode="numeric" value={u.guests} onChange={(e) => setUnit(i, { guests: e.target.value })} />
              </label>
              <label className={label}>
                Spavaćih soba
                <input className="admin-input" inputMode="numeric" value={u.bedrooms} onChange={(e) => setUnit(i, { bedrooms: e.target.value })} />
              </label>
              <label className={label}>
                Kupaonica (npr. 1,5)
                <input className="admin-input" value={u.bathrooms} onChange={(e) => setUnit(i, { bathrooms: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={label}>
                Opis (HR)
                <textarea className="admin-input" rows={4} value={u.description} onChange={(e) => setUnit(i, { description: e.target.value })} />
              </label>
              <label className={label}>
                Opis (EN)
                <textarea className="admin-input" rows={4} value={u.descriptionEn} onChange={(e) => setUnit(i, { descriptionEn: e.target.value })} />
              </label>
              <label className={label}>
                Karakteristike (HR) — jedna po retku
                <textarea className="admin-input" rows={6} value={u.features} onChange={(e) => setUnit(i, { features: e.target.value })} />
              </label>
              <label className={label}>
                Karakteristike (EN) — jedna po retku
                <textarea className="admin-input" rows={6} value={u.featuresEn} onChange={(e) => setUnit(i, { featuresEn: e.target.value })} />
              </label>
            </div>
            <label className={label}>
              iCal link ovog apartmana (Booking.com/Airbnb &bdquo;Export calendar&ldquo;) — opcionalno
              <input className="admin-input" value={u.icalUrl} placeholder="https://…" onChange={(e) => setUnit(i, { icalUrl: e.target.value })} />
            </label>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
            onClick={() => setUnits((l) => [...l, emptyUnit()])}
          >
            + Dodaj apartman
          </button>
          {missing.map((n) => (
            <button
              key={n}
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-dashed border-black/25 hover:border-black/50"
              onClick={() => setUnits((l) => [...l, emptyUnit(n)])}
            >
              + {n} (iz cjenika)
            </button>
          ))}
        </div>
      </section>

      <section className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">Doživite {location || "destinaciju"}</h2>
          <p className="text-xs text-black/55 mt-1 leading-relaxed">
            Sekcija o otoku/mjestu na stranici (Grand layout). Fotografije: u galeriji gore slikama postavite kategoriju
            &bdquo;{location || "Lokacija"}&ldquo;.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={label}>
            Naslov (HR) — npr. Otok {location}
            <input className="admin-input" value={dest.title} onChange={(e) => setDest((d) => ({ ...d, title: e.target.value }))} />
          </label>
          <label className={label}>
            Naslov (EN)
            <input className="admin-input" value={dest.titleEn} onChange={(e) => setDest((d) => ({ ...d, titleEn: e.target.value }))} />
          </label>
          <label className={label}>
            Uvod (HR)
            <textarea className="admin-input" rows={5} value={dest.intro} onChange={(e) => setDest((d) => ({ ...d, intro: e.target.value }))} />
          </label>
          <label className={label}>
            Uvod (EN)
            <textarea className="admin-input" rows={5} value={dest.introEn} onChange={(e) => setDest((d) => ({ ...d, introEn: e.target.value }))} />
          </label>
        </div>
        {dest.highlights.map((h, i) => (
          <div key={i} className="border border-black/10 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={label}>
              Naslov (HR)
              <input className="admin-input" value={h.title} onChange={(e) => setHighlight(i, { title: e.target.value })} />
            </label>
            <label className={label}>
              Naslov (EN)
              <input className="admin-input" value={h.titleEn} onChange={(e) => setHighlight(i, { titleEn: e.target.value })} />
            </label>
            <label className={label}>
              Tekst (HR)
              <textarea className="admin-input" rows={3} value={h.text} onChange={(e) => setHighlight(i, { text: e.target.value })} />
            </label>
            <label className={label}>
              Tekst (EN)
              <textarea className="admin-input" rows={3} value={h.textEn} onChange={(e) => setHighlight(i, { textEn: e.target.value })} />
            </label>
            <button
              type="button"
              className="text-xs underline text-red-700 justify-self-start"
              onClick={() => setDest((d) => ({ ...d, highlights: d.highlights.filter((_, j) => j !== i) }))}
            >
              Ukloni stavku
            </button>
          </div>
        ))}
        <button
          type="button"
          className="self-start text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
          onClick={() => setDest((d) => ({ ...d, highlights: [...d.highlights, { title: "", titleEn: "", text: "", textEn: "" }] }))}
        >
          + Dodaj stavku (npr. plaže, svjetionik…)
        </button>
      </section>

      <section className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">Engleska verzija stranice (ručno)</h2>
          <p className="text-xs text-black/55 mt-1 leading-relaxed">
            Hrvatski tekst se upisuje gore u osnovnim poljima (slogan, opis, sadržaji, oznake). Ovdje upišite engleski tekst
            koji se prikazuje na /en/ stranici. Prazno polje = automatski prijevod hrvatskog teksta.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={label}>
            Slogan (EN)
            <input className="admin-input" value={texts.taglineEn} onChange={(e) => setTexts((t) => ({ ...t, taglineEn: e.target.value }))} />
          </label>
          <label className={label}>
            Oznake / okruženje (EN), jedna po retku
            <textarea className="admin-input" rows={2} value={texts.badgesEn} onChange={(e) => setTexts((t) => ({ ...t, badgesEn: e.target.value }))} />
          </label>
          <label className={label + " sm:col-span-2"}>
            Opis objekta (EN)
            <textarea className="admin-input" rows={7} value={texts.descriptionEn} onChange={(e) => setTexts((t) => ({ ...t, descriptionEn: e.target.value }))} />
          </label>
          <label className={label + " sm:col-span-2"}>
            Sadržaji (EN), jedan po retku
            <textarea className="admin-input" rows={6} value={texts.amenitiesEn} onChange={(e) => setTexts((t) => ({ ...t, amenitiesEn: e.target.value }))} />
          </label>
        </div>
      </section>

      <section className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">Citat na sredini stranice</h2>
          <p className="text-xs text-black/55 mt-1 leading-relaxed">Prikazuje se umjesto ponovljenog slogana. Prazno = slogan kao i dosad.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={label}>
            Natpis iznad citata (npr. LASTOVO · PASADUR)
            <input className="admin-input" value={texts.quoteKicker} onChange={(e) => setTexts((t) => ({ ...t, quoteKicker: e.target.value }))} />
          </label>
          <label className={label}>
            Autor citata
            <input className="admin-input" value={texts.quoteBy} onChange={(e) => setTexts((t) => ({ ...t, quoteBy: e.target.value }))} />
          </label>
          <label className={label}>
            Citat (HR)
            <textarea className="admin-input" rows={2} value={texts.quote} onChange={(e) => setTexts((t) => ({ ...t, quote: e.target.value }))} />
          </label>
          <label className={label}>
            Citat (EN)
            <textarea className="admin-input" rows={2} value={texts.quoteEn} onChange={(e) => setTexts((t) => ({ ...t, quoteEn: e.target.value }))} />
          </label>
        </div>
      </section>

      <details className="border border-black/10 rounded-xl p-4 bg-white">
        <summary className="text-xs font-semibold cursor-pointer text-black/60">Napredno: uvoz/izvoz (JSON)</summary>
        <p className="text-xs text-black/50 mt-2">Zalijepi JSON {"{ units: [...], destination: {...} }"} da odjednom popuniš polja iznad.</p>
        <textarea
          id="units-json-import"
          className="admin-input mt-2 w-full font-mono text-xs"
          rows={4}
          placeholder={payload.slice(0, 120) + "…"}
          onChange={(e) => importJson(e.target.value)}
        />
        {jsonError && <p className="text-xs text-red-700 mt-1">{jsonError}</p>}
      </details>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50">
          {pending ? "Spremam…" : "Spremi apartmane, destinaciju i engleski tekst"}
        </button>
        {state && <span className={"text-sm " + (state.ok ? "text-green-700" : "text-red-700")}>{state.message}</span>}
      </div>
    </form>
  );
}
