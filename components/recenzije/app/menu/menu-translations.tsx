"use client";

import { useId, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { translateTextsAction } from "@/lib/recenzije/actions/menu";
import { Button } from "@/components/recenzije/ui/button";
import { Field, Input, Textarea } from "@/components/recenzije/ui/primitives";
import { LANG_NAMES, TRANS_LANGS, type TransLang } from "@/lib/recenzije/menu-lang";
import { cn } from "@/lib/recenzije/utils";

/**
 * Grupa "Prijevodi" u obrascu stavke, kategorije i uvoda: kartice EN / DE / IT s poljima za prijevod i gumb "Prevedi (AI nacrt)".
 * AI nacrt se upisuje SAMO u prazna polja, označen je kao nacrt (oznaka nestaje čim operater tekst promijeni) i ništa se ne
 * sprema dok operater ne spremi sam obrazac. Hrvatski tekst, cijene i alergeni se nikad ne šalju ni ne mijenjaju.
 */

export type TransValue = { name: string; description: string };
export type TransValues = Record<TransLang, TransValue>;

export const emptyTransValues = (): TransValues => ({ en: { name: "", description: "" }, de: { name: "", description: "" }, it: { name: "", description: "" } });

export const AI_OFF_TEXT = "AI prijevod trenutno nije uključen. Javite se NOVO-u. Prijevode možete upisati ručno.";

type Kind = "category" | "item" | "intro";

const LIMITS = { name: 120, description: 400, intro: 600 } as const;

export function TranslationsGroup({
  kind,
  hrName,
  hrDescription,
  values,
  onChange,
  aiEnabled,
  readOnly,
  errors,
  idPrefix,
}: {
  kind: Kind;
  /** Hrvatski tekst iz obrasca (može biti nespremljen). */
  hrName: string;
  hrDescription: string;
  values: TransValues;
  onChange: (next: TransValues) => void;
  aiEnabled: boolean;
  readOnly: boolean;
  errors?: Record<string, string>;
  idPrefix: string;
}) {
  const uid = useId();
  const [active, setActive] = useState<TransLang>("en");
  const [pending, start] = useTransition();
  /** Polja koja je napisao AI i operater ih još nije mijenjao: "en.name", "de.description" ... */
  const [drafted, setDrafted] = useState<Record<string, true>>({});

  const hrText = kind === "intro" ? hrDescription : hrName;
  const hasSource = Boolean(hrText.trim());
  const hasText = (l: TransLang) => Boolean(values[l].name.trim() || values[l].description.trim());

  function set(l: TransLang, field: "name" | "description", v: string) {
    onChange({ ...values, [l]: { ...values[l], [field]: v } });
    setDrafted((d) => {
      const k = `${l}.${field}`;
      if (!d[k]) return d;
      const { [k]: _gone, ...rest } = d;
      void _gone;
      return rest;
    });
  }

  function translate() {
    const need: Partial<Record<TransLang, ("name" | "description")[]>> = {};
    for (const l of TRANS_LANGS) {
      const f: ("name" | "description")[] = [];
      if (kind === "intro") {
        if (!values[l].description.trim()) f.push("description");
      } else {
        if (!values[l].name.trim()) f.push("name");
        if (kind === "item" && hrDescription.trim() && !values[l].description.trim()) f.push("description");
      }
      if (f.length) need[l] = f;
    }
    if (Object.keys(need).length === 0) {
      toast.info("Nema praznih polja za prevesti.");
      return;
    }
    start(async () => {
      const r = await translateTextsAction({ kind, name: hrName, description: hrDescription, need });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const f = r.data.fields;
      const next = { ...values, en: { ...values.en }, de: { ...values.de }, it: { ...values.it } };
      const marked: Record<string, true> = {};
      for (const l of TRANS_LANGS) {
        const L = l[0].toUpperCase() + l.slice(1);
        const nameV = kind === "intro" ? undefined : f[`name${L}` as keyof typeof f];
        const descV = f[(kind === "intro" ? `intro${L}` : `description${L}`) as keyof typeof f];
        // Upisuje se samo tamo gdje je polje još prazno (operater je u međuvremenu mogao nešto upisati).
        if (nameV && !next[l].name.trim()) {
          next[l].name = nameV;
          marked[`${l}.name`] = true;
        }
        if (descV && !next[l].description.trim()) {
          next[l].description = descV;
          marked[`${l}.description`] = true;
        }
      }
      onChange(next);
      setDrafted((d) => ({ ...d, ...marked }));
      toast.success(r.message);
    });
  }

  const draftBadge = (l: TransLang, field: "name" | "description") =>
    drafted[`${l}.${field}`] ? <span className="ml-2 border border-orange/60 bg-orange-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-warning">AI nacrt</span> : null;

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Jezik prijevoda" className="grid grid-cols-3 border border-foreground">
        {TRANS_LANGS.map((l) => {
          const on = l === active;
          return (
            <button
              key={l}
              type="button"
              role="tab"
              id={`${uid}-tab-${l}`}
              aria-selected={on}
              aria-controls={`${uid}-panel-${l}`}
              onClick={() => setActive(l)}
              className={cn("label flex min-h-11 cursor-pointer items-center justify-center gap-1.5 transition-colors", on ? "bg-foreground text-white" : "bg-white text-foreground hover:bg-surface-2")}
            >
              {l.toUpperCase()}
              {hasText(l) && <span aria-label="ima prijevod" className={cn("size-1.5 rounded-full", on ? "bg-white" : "bg-foreground")} />}
            </button>
          );
        })}
      </div>

      {TRANS_LANGS.map((l) => (
        <div key={l} id={`${uid}-panel-${l}`} role="tabpanel" aria-labelledby={`${uid}-tab-${l}`} hidden={l !== active} className="space-y-4">
          {kind !== "intro" && (
            <Field
              label={
                <span className="inline-flex items-center">
                  Naziv ({LANG_NAMES[l].toLowerCase()}) {draftBadge(l, "name")}
                </span>
              }
              htmlFor={`${idPrefix}-name-${l}`}
              error={errors?.[`name${l[0].toUpperCase()}${l.slice(1)}`]}
            >
              <Input
                id={`${idPrefix}-name-${l}`}
                lang={l}
                value={values[l].name}
                maxLength={LIMITS.name}
                disabled={readOnly}
                onChange={(e) => set(l, "name", e.target.value)}
                autoComplete="off"
              />
            </Field>
          )}
          {kind !== "category" && (
            <Field
              label={
                <span className="inline-flex items-center">
                  {kind === "intro" ? "Uvod" : "Opis"} ({LANG_NAMES[l].toLowerCase()}) {draftBadge(l, "description")}
                </span>
              }
              htmlFor={`${idPrefix}-desc-${l}`}
              error={errors?.[`${kind === "intro" ? "intro" : "description"}${l[0].toUpperCase()}${l.slice(1)}`]}
            >
              <Textarea
                id={`${idPrefix}-desc-${l}`}
                lang={l}
                rows={kind === "intro" ? 3 : 2}
                value={values[l].description}
                maxLength={kind === "intro" ? LIMITS.intro : LIMITS.description}
                disabled={readOnly}
                onChange={(e) => set(l, "description", e.target.value)}
                className="min-h-16"
              />
            </Field>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <Button type="button" size="sm" variant="secondary" disabled={!aiEnabled || !hasSource} loading={pending} onClick={translate}>
            <Sparkles /> Prevedi (AI nacrt)
          </Button>
          <p className="text-xs text-muted" id={`${uid}-ai-note`}>
            {!aiEnabled
              ? AI_OFF_TEXT
              : !hasSource
                ? "Najprije upišite hrvatski tekst."
                : "AI nacrt, provjerite prije objave. Popunjava samo prazna polja svih triju jezika; ništa se ne sprema dok ne spremite obrazac."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Slika stanja za jednoredni sažetak u popisu: koji jezici imaju barem jedan tekst. */
export function translationBadges(r: Partial<Record<TransLang, boolean>>): string {
  return TRANS_LANGS.filter((l) => r[l]).map((l) => l.toUpperCase()).join(" ");
}
