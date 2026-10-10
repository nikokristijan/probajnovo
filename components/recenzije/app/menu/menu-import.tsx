"use client";

import { useState, useTransition } from "react";
import { CircleAlert, ClipboardPaste, Eraser, Eye, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { previewMenuImportAction, saveMenuImportAction, type ImportPreviewData } from "@/lib/recenzije/actions/menu";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Card, CardBody, CardHeader, Textarea } from "@/components/recenzije/ui/primitives";
import { formatPriceCents } from "@/lib/recenzije/menu-format";
import { IMPORT_LIMITS } from "@/lib/recenzije/menu-import";
import { cn } from "@/lib/recenzije/utils";

const EXAMPLE = `Pizze
Margherita 8,50
Capricciosa - šunka, gljive, sir 10,00
Pizza tartufi
rajčica, mozzarella, tartufi
12,00

Pića
Cappuccino 2,00
Pivo 0,5 l ........ 4,20 €`;

/** Brzi uvoz: zalijepite tekst jelovnika, pregledajte što će nastati, pa spremite (dodaj ili zamijeni). */
export function MenuImport({ readOnly, onSaved }: { readOnly: boolean; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [previewed, setPreviewed] = useState<{ text: string; data: ImportPreviewData } | null>(null);
  const [replace, setReplace] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();

  const fresh = previewed !== null && previewed.text === text;
  const data = fresh ? previewed.data : null;
  const existingItems = data?.existing.items ?? 0;
  const lines = previewed ? previewed.text.replace(/\r\n?/g, "\n").split("\n") : [];

  function preview() {
    setError(null);
    startCheck(async () => {
      const r = await previewMenuImportAction(text);
      if (r.ok) {
        setPreviewed({ text, data: r.data });
        setReplace(false);
        setUnderstood(false);
      } else {
        setPreviewed(null);
        setError(r.error);
      }
    });
  }

  function save() {
    if (!data) return;
    setError(null);
    startSave(async () => {
      const r = await saveMenuImportAction(text, replace);
      if (r.ok) {
        toast.success(r.message);
        setText("");
        setPreviewed(null);
        setReplace(false);
        setUnderstood(false);
        onSaved();
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  const canSave = Boolean(data) && data!.parsed.stats.items > 0 && (!replace || existingItems === 0 || understood) && !readOnly;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Brzi uvoz iz teksta"
          description="Zalijepite jelovnik iz Worda, PDF-a ili poruke. Prepoznat ćemo kategorije, nazive, opise i cijene, a vi prije spremanja vidite što će nastati."
        />
        <CardBody className="space-y-4">
          <details className="border border-border bg-surface-2 px-3 py-2.5 [&[open]>summary]:mb-3">
            <summary className="label flex min-h-6 cursor-pointer select-none items-center text-muted">Kako treba izgledati tekst</summary>
            <ul className="space-y-1.5 text-[13px] text-foreground/80">
              <li>Redak koji završava cijenom je stavka: <code className="font-mono text-xs">Margherita 8,50</code> ili <code className="font-mono text-xs">Pivo ...... 4,20 €</code>.</li>
              <li>Redak bez cijene je naziv kategorije: <code className="font-mono text-xs">Pizze</code>.</li>
              <li>Opis ide iza crtice (<code className="font-mono text-xs">Capricciosa - šunka, sir 10,00</code>) ili u redak ispod naziva.</li>
              <li>Prazan redak otvara novu kategoriju.</li>
            </ul>
            <pre className="mt-3 overflow-x-auto whitespace-pre border border-border bg-white p-3 font-mono text-xs leading-relaxed">{EXAMPLE}</pre>
          </details>

          <div>
            <label htmlFor="imp-text" className="label mb-2 flex items-end justify-between gap-3 text-muted">
              <span>Tekst jelovnika</span>
              <span className="tabular normal-case tracking-normal">
                {text.length.toLocaleString("hr-HR")} / {IMPORT_LIMITS.maxChars.toLocaleString("hr-HR")}
              </span>
            </label>
            <Textarea
              id="imp-text"
              value={text}
              rows={10}
              maxLength={IMPORT_LIMITS.maxChars}
              disabled={readOnly}
              spellCheck={false}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              placeholder={"Pizze\nMargherita 8,50\n…"}
              className="min-h-56 font-mono text-[13px]"
              aria-invalid={error ? true : undefined}
            />
            {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={preview} loading={checking} disabled={!text.trim() || readOnly} className="sm:min-w-44">
              <Eye /> Pregledaj
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={readOnly}
              onClick={() => {
                setText(EXAMPLE);
                setError(null);
              }}
            >
              <ClipboardPaste /> Umetni primjer
            </Button>
            {text && (
              <Button
                size="lg"
                variant="ghost"
                onClick={() => {
                  setText("");
                  setPreviewed(null);
                  setError(null);
                }}
              >
                <Eraser /> Očisti
              </Button>
            )}
          </div>
          {readOnly && <p className="text-xs text-muted">Ovo je primjer za razgledavanje, spremanje je isključeno.</p>}
        </CardBody>
      </Card>

      {previewed && !fresh && (
        <Alert tone="amber" icon={TriangleAlert} title="Tekst je izmijenjen nakon pregleda">
          Ponovno kliknite „Pregledaj” da vidite što će se spremiti.
        </Alert>
      )}

      {data && (
        <Card aria-live="polite">
          <CardHeader title="Pregled" description="Ovo će se spremiti. Ništa još nije promijenjeno u jelovniku." />
          <CardBody className="space-y-5">
            <dl className="grid grid-cols-3 gap-3 border border-border bg-surface-2 p-3">
              <Stat label="Kategorije" value={data.parsed.stats.categories} />
              <Stat label="Stavke" value={data.parsed.stats.items} />
              <Stat label="Preskočeno" value={data.parsed.stats.skippedLines} tone={data.parsed.stats.skippedLines > 0 ? "warn" : undefined} />
            </dl>

            {data.parsed.warnings.length > 0 && (
              <div className="border-l-[3px] border-orange bg-orange-soft p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-warning">
                  <CircleAlert className="size-4 shrink-0" aria-hidden /> Provjerite ove retke ({data.parsed.warnings.length})
                </p>
                <ul className="mt-2 space-y-2.5">
                  {data.parsed.warnings.map((w, i) => (
                    <li key={`${w.line}-${i}`} className="min-w-0 text-[13px]">
                      <p className="text-foreground/80">
                        <span className="label mr-1.5 text-warning">Redak {w.line}</span>
                        {w.message}
                      </p>
                      {lines[w.line - 1]?.trim() && (
                        <code className="mt-1 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap border border-orange/40 bg-white px-2 py-1 font-mono text-xs">
                          {lines[w.line - 1].trim()}
                        </code>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.parsed.categories.length === 0 ? (
              <Alert tone="red" icon={CircleAlert} title="Nije prepoznata nijedna stavka">
                Svaka stavka mora završavati cijenom, npr. Margherita 8,50.
              </Alert>
            ) : (
              <div className="space-y-4">
                {data.parsed.categories.map((c) => (
                  <section key={c.name} className="min-w-0 border border-border">
                    <h3 className="flex items-baseline justify-between gap-3 border-b border-border bg-surface-2 px-3 py-2 text-sm font-bold">
                      <span className="min-w-0 break-words">{c.name}</span>
                      <span className="label shrink-0 text-muted">{c.items.length}</span>
                    </h3>
                    <ul className="divide-y divide-border">
                      {c.items.map((it) => (
                        <li key={`${it.line}-${it.name}`} className="flex items-start gap-3 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-bold leading-snug">{it.name}</p>
                            {it.description && <p className="break-words text-xs text-muted">{it.description}</p>}
                          </div>
                          <p className="tabular shrink-0 text-sm font-bold">{formatPriceCents(it.priceCents)}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {data.parsed.stats.items > 0 && (
              <div className="space-y-3 border-t border-border pt-5">
                {existingItems > 0 || data.existing.categories > 0 ? (
                  <fieldset className="min-w-0">
                    <legend className="label mb-2 text-muted">Što s postojećim jelovnikom?</legend>
                    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                      <ModeOption
                        checked={!replace}
                        onSelect={() => setReplace(false)}
                        title="Dodaj na kraj"
                        text={`Postojećih ${data.existing.items} stavki ostaje. Istoimene kategorije se spajaju.`}
                      />
                      <ModeOption
                        checked={replace}
                        onSelect={() => setReplace(true)}
                        title="Zamijeni cijeli jelovnik"
                        text="Briše sve postojeće kategorije i stavke pa sprema ovo."
                        danger
                      />
                    </div>
                    {replace && (
                      <div className="mt-3 border-l-[3px] border-danger bg-danger-soft p-4">
                        <p className="flex items-start gap-2 text-sm font-bold text-danger">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                          Zamjena trajno briše {data.existing.items} stavki u {data.existing.categories} kategorija i ne može se poništiti.
                        </p>
                        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="size-5 accent-black" />
                          Razumijem, obriši postojeće
                        </label>
                      </div>
                    )}
                  </fieldset>
                ) : null}
                <Button size="lg" variant={replace ? "danger" : "primary"} onClick={save} loading={saving} disabled={!canSave} className="w-full sm:w-auto">
                  <Save /> {replace ? "Zamijeni i spremi" : "Spremi u jelovnik"}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="min-w-0">
      <dt className="label text-muted">{label}</dt>
      <dd className={cn("tabular mt-1 text-2xl font-bold leading-none", tone === "warn" && "text-warning")}>{value}</dd>
    </div>
  );
}

function ModeOption({ checked, onSelect, title, text, danger }: { checked: boolean; onSelect: () => void; title: string; text: string; danger?: boolean }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 border p-3 transition-colors",
        checked ? (danger ? "border-danger bg-danger-soft" : "border-foreground bg-surface-2") : "border-border bg-white hover:border-border-strong"
      )}
    >
      <input type="radio" name="import-mode" checked={checked} onChange={onSelect} className="mt-1 size-4 accent-black" />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted">{text}</span>
      </span>
    </label>
  );
}
