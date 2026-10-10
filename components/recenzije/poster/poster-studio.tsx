"use client";

import { useState } from "react";
import { Download, ExternalLink, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { Card, CardBody, CardHeader, hitArea } from "@/components/recenzije/ui/primitives";
import { cn } from "@/lib/recenzije/utils";
import type { QrMatrix } from "@/lib/recenzije/services/qr";
import { POSTER_VARIANTS, posterFileName, qrOnlySvg, variantInfo, type PosterVariant } from "./poster-layout";
import { CopyLinkButton, saveSvg } from "./poster-shared";
import { buildPosterSvg } from "./poster-svg";

const PRINT_ID = "nr-poster-print";

/**
 * Pri ispisu nestaje sve osim plakata: svaki element koji nije plakat, njegov
 * potomak ni njegov predak se skriva, a preci se spljošte da dokument ne dobije
 * dodatne prazne stranice. Plakat je fiksiran u gornji lijevi kut na točnu
 * veličinu papira (A4 ili A6) i bez margina.
 */
function printCss(v: ReturnType<typeof variantInfo>) {
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

const TIPS = [
  <>
    Ispišite u mjerilu <b>100 %</b> (isključite „Prilagodi stranici”) i bez zaglavlja i podnožja. Format papira se postavlja sam.
  </>,
  <>Prije nego što ga zalijepite, isprobajte kod vlastitim mobitelom: skenirajte ispis s udaljenosti od jedne ruke.</>,
  <>Postavite ga na pult, stol ili uz blagajnu. A6 kartica stane u stalak za jelovnike ili u plastični džepić.</>,
  <>Isti link možete upisati i na NFC karticu, pa gost može i prisloniti mobitel umjesto skeniranja.</>,
];

export function PosterStudio({ orgName, reviewUrl, qr }: { orgName: string; reviewUrl: string; qr: QrMatrix }) {
  const [variant, setVariant] = useState<PosterVariant>("a4");
  const info = variantInfo(variant);

  // Isti graditelj za pregled i za datoteku, da se ne razilaze (React Compiler sam pamti rezultat).
  const preview = buildPosterSvg({ orgName, qr, variant, inline: true });

  function onRadioKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = POSTER_VARIANTS.findIndex((v) => v.id === variant);
    const next = POSTER_VARIANTS[(i + dir + POSTER_VARIANTS.length) % POSTER_VARIANTS.length];
    setVariant(next.id);
    requestAnimationFrame(() => document.getElementById(`poster-variant-${next.id}`)?.focus());
  }

  return (
    <>
      <style>{printCss(info)}</style>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="self-start lg:col-start-2 lg:row-start-1">
          <CardHeader title="Oblik i ispis" description="Isti kod, dva formata. Ispis i preuzimanje koriste odabrani oblik." />
          <CardBody className="space-y-5">
            <div role="radiogroup" aria-label="Oblik plakata" className="grid grid-cols-2 border border-foreground">
              {POSTER_VARIANTS.map((v) => {
                const on = v.id === variant;
                return (
                  <button
                    key={v.id}
                    id={`poster-variant-${v.id}`}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setVariant(v.id)}
                    onKeyDown={onRadioKey}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-1 px-3 py-3 text-left transition-colors sm:px-4",
                      on ? "bg-foreground text-white" : "bg-white text-foreground hover:bg-surface-2"
                    )}
                  >
                    <span className="text-sm font-bold">{v.label}</span>
                    <span className={cn("label", on ? "text-white/70" : "text-muted")}>{v.size}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <Button size="lg" className="sm:flex-1 lg:flex-none xl:flex-1" onClick={() => window.print()}>
                <Printer /> Ispiši
              </Button>
              <Button size="lg" variant="secondary" className="sm:flex-1 lg:flex-none xl:flex-1" onClick={() => saveSvg(posterFileName(orgName, variant), buildPosterSvg({ orgName, qr, variant }))}>
                <Download /> Preuzmi SVG
              </Button>
            </div>
            <button
              type="button"
              onClick={() => saveSvg(posterFileName(orgName, variant, "qr"), qrOnlySvg(qr))}
              className={cn(hitArea, "label -mt-2 inline-flex cursor-pointer items-center gap-2 text-accent underline underline-offset-4 hover:text-foreground")}
            >
              <QrCode className="size-3.5" /> Preuzmi samo QR kod (SVG)
            </button>

            <div className="min-w-0">
              <p className="label text-muted">Kamo vodi QR kod</p>
              <div className="mt-1.5 flex items-center gap-1 border border-border bg-surface-2 py-1 pl-3 pr-1">
                <code className="min-w-0 flex-1 truncate font-mono text-xs" title={reviewUrl}>
                  {reviewUrl}
                </code>
                <CopyLinkButton value={reviewUrl} />
                <Button size="sm" variant="ghost" asChild>
                  <a href={reviewUrl} target="_blank" rel="noopener noreferrer" aria-label="Otvori link u novoj kartici">
                    <ExternalLink />
                  </a>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted">Kod vodi izravno na vašu Google stranicu za recenziju. Skeniranja se ne broje; klikove prate samo linkovi iz SMS poruka.</p>
            </div>
          </CardBody>
        </Card>

        <div className="min-w-0 self-start border border-border bg-surface-2 p-4 sm:p-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
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
          </p>
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
