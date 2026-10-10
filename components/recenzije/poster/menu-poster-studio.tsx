"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Printer, QrCode } from "lucide-react";
import { buildMenuQrAction, buildMenuTableQrsAction } from "@/lib/recenzije/actions/menu";
import { MAX_TABLES, plural } from "@/components/recenzije/app/menu/menu-types";
import { Button } from "@/components/recenzije/ui/button";
import { Card, CardBody, CardHeader, Field, Input, hitArea } from "@/components/recenzije/ui/primitives";
import { cn } from "@/lib/recenzije/utils";
import type { QrMatrix } from "@/lib/recenzije/services/qr";
import { POSTER_VARIANTS, menuPosterFileName, qrOnlySvg, tableSheetFileName, variantInfo, type PosterVariant } from "./poster-layout";
import { CopyLinkButton, saveSvg } from "./poster-shared";
import { buildPosterSvg } from "./poster-svg";
import { buildTableSheetPages, sheetPageCount, type TableQr } from "./table-sheet-svg";

const PRINT_ID = "nr-poster-print";
const SHEET_ID = "nr-sheet-print";

type Mode = "single" | "sheet";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "single", label: "Jedan kod", hint: "Plakat ili kartica" },
  { id: "sheet", label: "Svi stolovi", hint: "A4 ploča s karticama" },
];

/** Isto kao kod plakata za recenziju: pri ispisu ostaje samo plakat, na točnoj veličini papira. */
function posterPrintCss(v: ReturnType<typeof variantInfo>) {
  const sel = `#${PRINT_ID}`;
  return `@media print {
  @page { size: ${v.page}; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
  body :not(:has(${sel})):not(${sel}):not(${sel} *) { display: none !important; }
  body :has(${sel}) { display: block !important; position: static !important; width: auto !important; height: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: visible !important; transform: none !important; filter: none !important; backdrop-filter: none !important; }
  ${sel} { display: block !important; position: fixed !important; left: 0 !important; top: 0 !important; width: ${v.widthMm}mm !important; height: ${v.heightMm}mm !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; background: #fff !important; }
  ${sel} svg { display: block !important; width: 100% !important; height: 100% !important; }
  ${sel}, ${sel} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
}

/** Ploča sa stolovima ima više A4 stranica: sadržaj teče normalno, a svaka stranica završava prijelomom. */
function sheetPrintCss() {
  const sel = `#${SHEET_ID}`;
  // Na ekranu se vidi samo odabrana stranica. Skrivanje ide ovdje (a ne atributom hidden) jer Tailwindov preflight
  // ima "[hidden] { display: none !important }" u sloju, a važne deklaracije slojeva pobjeđuju nesloženo pravilo za ispis.
  return `@media screen { ${sel} .nr-sheet-page[data-off] { display: none; } }
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
  body :not(:has(${sel})):not(${sel}):not(${sel} *) { display: none !important; }
  body :has(${sel}) { display: block !important; position: static !important; width: auto !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: visible !important; transform: none !important; filter: none !important; backdrop-filter: none !important; }
  ${sel} { display: block !important; position: static !important; width: 210mm !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; background: #fff !important; }
  ${sel} .nr-sheet-page { display: block !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; break-after: page; page-break-after: always; }
  ${sel} .nr-sheet-page:last-child { break-after: auto; page-break-after: auto; }
  ${sel} svg { display: block !important; width: 100% !important; height: 100% !important; }
  ${sel}, ${sel} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
}

const TIPS = [
  <>
    Ispišite u mjerilu <b>100 %</b> (isključite „Prilagodi stranici”) i bez zaglavlja i podnožja. Format papira se postavlja sam.
  </>,
  <>Prije ispisa isprobajte kod vlastitim mobitelom: skenirajte, upišite svoj broj i provjerite da se jelovnik otvara.</>,
  <>
    U načinu „Svi stolovi” svaki kod nosi broj stola, pa u popisu gostiju vidite s kojeg su stola došli. Izrežite kartice po isprekidanoj crti.
  </>,
  <>Ako promijenite adresu jelovnika u Postavkama, već ispisani kodovi prestaju raditi. Tada ispišite nove.</>,
];

type Current = { table: string; qr: QrMatrix; url: string };

/** Način "Jelovnik" na QR plakatu: QR vodi na /jelovnik/<slug>; neobavezan broj stola (?stol=) i ploča sa svim stolovima. */
export function MenuPosterStudio({
  orgName,
  baseUrl,
  initialQr,
  allowSkip,
}: {
  orgName: string;
  baseUrl: string;
  initialQr: QrMatrix;
  allowSkip: boolean;
}) {
  const [mode, setMode] = useState<Mode>("single");
  const [variant, setVariant] = useState<PosterVariant>("a4");
  const info = variantInfo(variant);

  // Jedan kod
  const [tableInput, setTableInput] = useState("");
  const [current, setCurrent] = useState<Current>({ table: "", qr: initialQr, url: baseUrl });
  const [tableError, setTableError] = useState<string | null>(null);
  const [qrPending, setQrPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");

  // Svi stolovi
  const [count, setCount] = useState("12");
  const [from, setFrom] = useState("1");
  const [sheetItems, setSheetItems] = useState<TableQr[] | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetPage, setSheetPage] = useState(0);
  const [building, buildSheet] = useTransition();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const typed = tableInput.replace(/\s+/g, " ").trim();
  const inSync = typed === current.table && !qrPending;
  const preview = buildPosterSvg({ orgName, qr: current.qr, variant, inline: true, kind: "menu", menu: { table: current.table, allowSkip } });
  const sheetPages = useMemo(() => (sheetItems ? buildTableSheetPages({ orgName, tables: sheetItems, inline: true }) : []), [orgName, sheetItems]);
  const pageIndex = Math.min(sheetPage, Math.max(0, sheetPages.length - 1));

  function onTableChange(raw: string) {
    setTableInput(raw);
    setTableError(null);
    if (timer.current) clearTimeout(timer.current);
    const v = raw.replace(/\s+/g, " ").trim();
    latest.current = v;
    if (v === "") {
      setQrPending(false);
      setCurrent({ table: "", qr: initialQr, url: baseUrl });
      return;
    }
    setQrPending(true);
    timer.current = setTimeout(async () => {
      const r = await buildMenuQrAction(v);
      if (latest.current !== v) return;
      setQrPending(false);
      if (r.ok) setCurrent({ table: v, qr: { size: r.data.size, path: r.data.path }, url: r.data.url });
      else setTableError(r.error);
    }, 350);
  }

  function makeSheet() {
    setSheetError(null);
    const c = Number(count);
    const f = Number(from);
    buildSheet(async () => {
      const r = await buildMenuTableQrsAction({ count: c, from: f });
      if (r.ok) {
        setSheetItems(r.data.items.map((i) => ({ label: i.label, qr: { size: i.size, path: i.path } })));
        setSheetPage(0);
      } else setSheetError(r.error);
    });
  }

  function onModeKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = MODES.findIndex((m) => m.id === mode);
    const next = MODES[(i + dir + MODES.length) % MODES.length];
    setMode(next.id);
    requestAnimationFrame(() => document.getElementById(`menu-poster-mode-${next.id}`)?.focus());
  }

  function onVariantKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = POSTER_VARIANTS.findIndex((v) => v.id === variant);
    const next = POSTER_VARIANTS[(i + dir + POSTER_VARIANTS.length) % POSTER_VARIANTS.length];
    setVariant(next.id);
    requestAnimationFrame(() => document.getElementById(`menu-poster-variant-${next.id}`)?.focus());
  }

  const urlShown = mode === "single" ? current.url : baseUrl;

  return (
    <>
      <style>{mode === "single" ? posterPrintCss(info) : sheetPrintCss()}</style>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="self-start lg:col-start-2 lg:row-start-1">
          <CardHeader title="Što ispisati" description="Jedan kod za plakat ili karticu, ili ploča sa svim stolovima." />
          <CardBody className="space-y-5">
            <div role="radiogroup" aria-label="Što ispisati" className="grid grid-cols-2 border border-foreground">
              {MODES.map((m) => {
                const on = m.id === mode;
                return (
                  <button
                    key={m.id}
                    id={`menu-poster-mode-${m.id}`}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setMode(m.id)}
                    onKeyDown={onModeKey}
                    className={cn(
                      "flex min-h-11 cursor-pointer flex-col items-start gap-1 px-3 py-3 text-left transition-colors sm:px-4",
                      on ? "bg-foreground text-white" : "bg-white text-foreground hover:bg-surface-2"
                    )}
                  >
                    <span className="text-sm font-bold">{m.label}</span>
                    <span className={cn("label", on ? "text-white/70" : "text-muted")}>{m.hint}</span>
                  </button>
                );
              })}
            </div>

            {mode === "single" ? (
              <>
                <div role="radiogroup" aria-label="Oblik plakata" className="grid grid-cols-2 border border-foreground">
                  {POSTER_VARIANTS.map((v) => {
                    const on = v.id === variant;
                    return (
                      <button
                        key={v.id}
                        id={`menu-poster-variant-${v.id}`}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        tabIndex={on ? 0 : -1}
                        onClick={() => setVariant(v.id)}
                        onKeyDown={onVariantKey}
                        className={cn(
                          "flex min-h-11 cursor-pointer flex-col items-start gap-1 px-3 py-3 text-left transition-colors sm:px-4",
                          on ? "bg-foreground text-white" : "bg-white text-foreground hover:bg-surface-2"
                        )}
                      >
                        <span className="text-sm font-bold">{v.label}</span>
                        <span className={cn("label", on ? "text-white/70" : "text-muted")}>{v.size}</span>
                      </button>
                    );
                  })}
                </div>

                <Field
                  label="Broj stola (neobavezno)"
                  htmlFor="mp-table"
                  error={tableError ?? undefined}
                  hint="Ako upišete broj, kod vodi na isti jelovnik s oznakom stola (?stol=). Oznaka je samo informativna: vidite je u popisu gostiju."
                >
                  <Input
                    id="mp-table"
                    value={tableInput}
                    maxLength={12}
                    inputMode="text"
                    autoComplete="off"
                    placeholder="npr. 12"
                    onChange={(e) => onTableChange(e.target.value)}
                    aria-invalid={tableError ? true : undefined}
                  />
                </Field>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                  <Button size="lg" className="sm:flex-1 lg:flex-none xl:flex-1" disabled={!inSync} onClick={() => window.print()}>
                    <Printer /> Ispiši
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="sm:flex-1 lg:flex-none xl:flex-1"
                    disabled={!inSync}
                    onClick={() =>
                      saveSvg(
                        menuPosterFileName(orgName, variant, "plakat", current.table),
                        buildPosterSvg({ orgName, qr: current.qr, variant, kind: "menu", menu: { table: current.table, allowSkip } })
                      )
                    }
                  >
                    <Download /> Preuzmi SVG
                  </Button>
                </div>
                <button
                  type="button"
                  disabled={!inSync}
                  onClick={() => saveSvg(menuPosterFileName(orgName, variant, "qr", current.table), qrOnlySvg(current.qr, "QR kod za jelovnik"))}
                  className={cn(hitArea, "label -mt-2 inline-flex cursor-pointer items-center gap-2 text-accent underline underline-offset-4 hover:text-foreground disabled:opacity-50")}
                >
                  <QrCode className="size-3.5" /> Preuzmi samo QR kod (SVG)
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Broj stolova" htmlFor="mp-count" hint={`Najviše ${MAX_TABLES}.`}>
                    <Input id="mp-count" type="number" inputMode="numeric" min={1} max={MAX_TABLES} value={count} onChange={(e) => setCount(e.target.value)} />
                  </Field>
                  <Field label="Prvi stol" htmlFor="mp-from" hint="Obično 1.">
                    <Input id="mp-from" type="number" inputMode="numeric" min={0} max={9999} value={from} onChange={(e) => setFrom(e.target.value)} />
                  </Field>
                </div>
                {sheetError && <p className="-mt-2 text-xs text-danger">{sheetError}</p>}
                <Button size="lg" variant={sheetItems ? "secondary" : "primary"} loading={building} onClick={makeSheet} className="w-full">
                  <QrCode /> {sheetItems ? "Napravi ponovno" : "Napravi ploču"}
                </Button>
                {sheetItems && (
                  <div className="space-y-3 border-t border-border pt-5">
                    <p className="text-sm text-muted">
                      <b className="text-foreground">{sheetItems.length}</b> {plural(sheetItems.length, "kartica", "kartice", "kartica")} na{" "}
                      <b className="text-foreground">{sheetPages.length}</b> {plural(sheetPages.length, "stranici", "stranice", "stranica")} A4 (po 12 na stranici).
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                      <Button size="lg" className="sm:flex-1 lg:flex-none xl:flex-1" onClick={() => window.print()}>
                        <Printer /> Ispiši ploču
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        className="sm:flex-1 lg:flex-none xl:flex-1"
                        onClick={() => {
                          const files = buildTableSheetPages({ orgName, tables: sheetItems });
                          saveSvg(tableSheetFileName(orgName, pageIndex + 1), files[pageIndex] ?? files[0]);
                        }}
                      >
                        <Download /> Preuzmi SVG ({pageIndex + 1}. str.)
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="min-w-0">
              <p className="label text-muted">Kamo vodi QR kod</p>
              <div className="mt-1.5 flex items-center gap-1 border border-border bg-surface-2 py-1 pl-3 pr-1">
                <code className="min-w-0 flex-1 truncate font-mono text-xs" title={urlShown}>
                  {urlShown}
                </code>
                <CopyLinkButton value={urlShown} />
                <Button size="sm" variant="ghost" asChild>
                  <a href={urlShown} target="_blank" rel="noopener noreferrer" aria-label="Otvori jelovnik u novoj kartici">
                    <ExternalLink />
                  </a>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted">
                Kod vodi na jelovnik na našoj stranici. {allowSkip ? "Gost može otvoriti jelovnik i bez broja." : "Gost prvo upisuje broj mobitela, pa tek onda vidi jelovnik."}
              </p>
            </div>
          </CardBody>
        </Card>

        <div className="min-w-0 self-start border border-border bg-surface-2 p-4 sm:p-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {mode === "single" ? (
            <>
              <div
                id={PRINT_ID}
                className={cn(
                  "mx-auto w-full border border-foreground bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.08)]",
                  variant === "a4" ? "max-w-[440px]" : "max-w-[300px]"
                )}
                // Sadržaj gradi poster-svg.ts iz escapeanih podataka; nema korisničkog HTML-a.
                dangerouslySetInnerHTML={{ __html: preview }}
              />
              <p className="label mt-5 text-center text-muted">
                Pregled · {info.label} · {info.size}
                {current.table ? ` · stol ${current.table}` : ""}
              </p>
            </>
          ) : sheetItems ? (
            <>
              <div id={SHEET_ID} className="mx-auto w-full max-w-[440px] border border-foreground bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.08)]">
                {sheetPages.map((svg, i) => (
                  <div key={i} className="nr-sheet-page" data-off={i === pageIndex ? undefined : ""} dangerouslySetInnerHTML={{ __html: svg }} />
                ))}
              </div>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button size="icon" variant="outline" aria-label="Prethodna stranica" disabled={pageIndex === 0} onClick={() => setSheetPage(pageIndex - 1)}>
                  <ChevronLeft />
                </Button>
                <p className="label min-w-32 text-center text-muted">
                  Stranica {pageIndex + 1} od {sheetPages.length}
                </p>
                <Button size="icon" variant="outline" aria-label="Sljedeća stranica" disabled={pageIndex >= sheetPages.length - 1} onClick={() => setSheetPage(pageIndex + 1)}>
                  <ChevronRight />
                </Button>
              </div>
              <p className="label mt-3 text-center text-muted">
                Pregled · A4 · stolovi {sheetItems[0]?.label} do {sheetItems[sheetItems.length - 1]?.label} · {sheetPageCount(sheetItems.length)} str.
              </p>
            </>
          ) : (
            <div className="mx-auto flex aspect-[210/297] w-full max-w-[440px] flex-col items-center justify-center border border-dashed border-border-strong bg-white p-8 text-center">
              <QrCode className="size-8 text-muted" aria-hidden />
              <p className="mt-3 text-sm font-bold">Ploča sa svim stolovima</p>
              <p className="mt-1 max-w-64 text-[13px] text-muted">Upišite broj stolova i kliknite „Napravi ploču”. Ovdje se pojavljuje pregled stranica za ispis.</p>
            </div>
          )}
        </div>

        <Card className="self-start lg:col-start-2 lg:row-start-2">
          <CardHeader title="Prije ispisa" />
          <CardBody>
            <ol className="space-y-3 text-[14px] leading-relaxed">
              {TIPS.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="label mt-0.5 shrink-0 text-accent">0{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
