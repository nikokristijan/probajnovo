"use client";

import { useRef, useState } from "react";
import { Languages, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { applyMenuTranslationsAction, draftMenuTranslationsAction } from "@/lib/recenzije/actions/menu";
import type { DraftEntry } from "@/lib/recenzije/services/menu-translate";
import { Button } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent } from "@/components/recenzije/ui/dialog";
import { Alert, Input, Textarea } from "@/components/recenzije/ui/primitives";
import { LANG_NAMES, TRANS_LANGS, type TransLang } from "@/lib/recenzije/menu-lang";
import { AI_OFF_TEXT } from "./menu-translations";

/** "nameEn" -> "EN naziv" */
function fieldLabel(key: string): string {
  const m = /^(name|description|intro)(En|De|It)$/.exec(key);
  if (!m) return key;
  const what = m[1] === "name" ? "naziv" : m[1] === "description" ? "opis" : "uvod";
  return `${m[2].toUpperCase()} ${what}`;
}

type Row = DraftEntry & { include: boolean };
type Phase = "setup" | "running" | "review" | "saving";

/**
 * "Prevedi cijeli jelovnik": AI nacrt prijevoda za sve stavke, kategorije i uvod kojima nedostaje prijevod, korak po korak (do 10 unosa po
 * pozivu, s napretkom i prekidom). Nacrt se ne sprema sam: tek kad operater pregleda (i po želji ispravi ili odbaci) pa potvrdi.
 * Popunjava samo prazna polja; cijene, alergeni i hrvatski tekst se ne šalju ni ne mijenjaju.
 */
export function MenuTranslateAll({ aiEnabled }: { aiEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [langs, setLangs] = useState<TransLang[]>([...TRANS_LANGS]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const cancel = useRef(false);

  function reset() {
    setPhase("setup");
    setRows([]);
    setError(null);
    setEmpty(false);
    setProgress({ done: 0, total: 0 });
  }

  function close() {
    cancel.current = true;
    setOpen(false);
    reset();
  }

  async function start() {
    reset();
    cancel.current = false;
    setPhase("running");
    const collected: Row[] = [];
    let offset = 0;
    let done = 0;
    let total = 0;
    for (let guard = 0; guard < 60; guard++) {
      const r = await draftMenuTranslationsAction({ langs, offset });
      if (!r.ok) {
        setError(r.error);
        break;
      }
      total = r.data.total;
      done += r.data.processed;
      collected.push(...r.data.drafts.map((d) => ({ ...d, include: true })));
      setProgress({ done, total });
      if (r.data.nextOffset === null || cancel.current) break;
      offset = r.data.nextOffset;
    }
    setRows(collected);
    setEmpty(collected.length === 0 && total === 0);
    setPhase("review");
  }

  async function save() {
    const chosen = rows.filter((r) => r.include && Object.keys(r.fields).length > 0).map(({ include: _i, ...e }) => (void _i, e));
    if (chosen.length === 0) {
      toast.info("Ništa nije odabrano.");
      return;
    }
    setPhase("saving");
    let applied = 0;
    let skipped = 0;
    for (let i = 0; i < chosen.length; i += 200) {
      const r = await applyMenuTranslationsAction(chosen.slice(i, i + 200));
      if (!r.ok) {
        toast.error(r.error);
        setPhase("review");
        return;
      }
      applied += r.data.applied;
      skipped += r.data.skipped;
    }
    toast.success(applied > 0 ? `Spremljeno prijevoda: ${applied}.${skipped ? ` Preskočeno ${skipped} (polje je već ispunjeno).` : ""}` : "Ništa nije spremljeno: sva su polja već ispunjena.");
    close();
  }

  const included = rows.filter((r) => r.include).length;

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={!aiEnabled} title={aiEnabled ? undefined : AI_OFF_TEXT}>
        <Languages /> Prevedi cijeli jelovnik
      </Button>
      {!aiEnabled && <span className="sr-only">{AI_OFF_TEXT}</span>}

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent title="Prevedi cijeli jelovnik" description="AI nacrt, provjerite prije objave." wide>
          {phase === "setup" && (
            <div className="space-y-4">
              <p className="text-sm text-foreground/80">
                AI će iz hrvatskog teksta napraviti nacrt prijevoda za sve nazive i opise u kojima prijevod još nedostaje. Popunjava se samo ono što je prazno; cijene, alergeni i hrvatski tekst se ne
                diraju. Ništa se ne objavljuje dok ne pregledate nacrt i ne kliknete Spremi.
              </p>
              <fieldset className="space-y-1">
                <legend className="label mb-1 text-muted">Jezici</legend>
                {TRANS_LANGS.map((l) => (
                  <label key={l} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 accent-black"
                      checked={langs.includes(l)}
                      onChange={(e) => setLangs((cur) => (e.target.checked ? TRANS_LANGS.filter((x) => x === l || cur.includes(x)) : cur.filter((x) => x !== l)))}
                    />
                    {LANG_NAMES[l]} ({l.toUpperCase()})
                  </label>
                ))}
              </fieldset>
              {error && <Alert tone="red" title={error} />}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={close}>
                  Odustani
                </Button>
                <Button type="button" disabled={langs.length === 0} onClick={start}>
                  <Sparkles /> Napravi nacrt
                </Button>
              </div>
            </div>
          )}

          {phase === "running" && (
            <div className="space-y-4" role="status" aria-live="polite">
              <p className="text-sm">
                Prevodim… {progress.total > 0 ? `${Math.min(progress.done, progress.total)} od ${progress.total} unosa` : "pripremam"}
              </p>
              <div className="h-2 w-full bg-surface-3" aria-hidden>
                <div className="h-2 bg-foreground transition-all" style={{ width: `${progress.total ? Math.round((Math.min(progress.done, progress.total) / progress.total) * 100) : 5}%` }} />
              </div>
              <Button type="button" variant="ghost" onClick={() => (cancel.current = true)}>
                Prekini nakon ovog koraka
              </Button>
            </div>
          )}

          {(phase === "review" || phase === "saving") && (
            <div className="space-y-4">
              {error && <Alert tone="red" title="Prevođenje je prekinuto">{`${error} Ispod je ono što je do tada pripremljeno.`}</Alert>}
              {rows.length === 0 ? (
                <p className="text-sm text-foreground/80">{empty ? "Nema ničega za prevesti: svi odabrani prijevodi već postoje." : "AI nije vratio nijedan prijevod. Pokušajte ponovno."}</p>
              ) : (
                <>
                  <Alert tone="amber" title="AI nacrt, provjerite prije objave">Ništa još nije spremljeno. Ispravite tekst ili odznačite unos koji ne želite, pa kliknite Spremi.</Alert>
                  <ul className="max-h-[52dvh] divide-y divide-border overflow-y-auto border border-border">
                    {rows.map((r, i) => (
                      <li key={`${r.kind}-${r.id}`} className="space-y-2 px-3 py-3">
                        <label className="flex min-h-9 cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-5 shrink-0 accent-black"
                            checked={r.include}
                            onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                          />
                          <span className="min-w-0 break-words font-bold">
                            {r.kind === "intro" ? "Uvod: " : ""}
                            {r.label}
                          </span>
                        </label>
                        <div className="space-y-2 pl-8">
                          {Object.entries(r.fields).map(([k, v]) => (
                            <label key={k} className="block">
                              <span className="label mb-1 block text-muted">{fieldLabel(k)}</span>
                              {k.startsWith("name") ? (
                                <Input
                                  lang={k.slice(-2).toLowerCase()}
                                  value={v}
                                  maxLength={120}
                                  disabled={!r.include || phase === "saving"}
                                  onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, fields: { ...x.fields, [k]: e.target.value } } : x)))}
                                />
                              ) : (
                                <Textarea
                                  lang={k.slice(-2).toLowerCase()}
                                  rows={3}
                                  value={v}
                                  maxLength={k.startsWith("intro") ? 600 : 400}
                                  disabled={!r.include || phase === "saving"}
                                  onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, fields: { ...x.fields, [k]: e.target.value } } : x)))}
                                  className="min-h-16"
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={close}>
                  Odbaci nacrt
                </Button>
                {rows.length > 0 && (
                  <Button type="button" loading={phase === "saving"} disabled={included === 0} onClick={save}>
                    Spremi odabrano ({included})
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
