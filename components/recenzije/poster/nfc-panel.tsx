"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { cn } from "@/lib/recenzije/utils";
import { copyText } from "./poster-shared";
import { HOSPITALITY_SETUP, formatEur, piecesLabel } from "@/lib/hospitality-plans";
import { pieceTotals, type NfcRow } from "./nfc-urls";

/** Gumb "Kopiraj" koji nakratko pokaže "Kopirano" (uz obavijest), visine 44 px za dodir. */
function RowCopy({ value, label, done }: { value: string; label: string; done?: string }) {
  const [ok, setOk] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-11 min-w-[7rem] shrink-0 sm:pointer-fine:h-11"
      aria-label={label}
      onClick={async () => {
        if (!(await copyText(value, done))) return;
        setOk(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setOk(false), 1600);
      }}
    >
      {ok ? (
        <>
          <Check /> Kopirano
        </>
      ) : (
        "Kopiraj"
      )}
    </Button>
  );
}

function UrlRow({ label, url, hint, copyLabel }: { label: string; url: string; hint?: string; copyLabel: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-2.5 last:border-b-0 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:px-4">
      <div className="min-w-0 sm:col-start-1">
        <p className="text-sm font-bold">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <code className="col-span-2 row-start-2 min-w-0 break-all font-mono text-xs leading-snug sm:col-span-1 sm:col-start-2 sm:row-start-1" data-nfc-url={url}>
        {url}
      </code>
      <div className="col-start-2 row-start-1 flex items-center gap-1 sm:col-start-3">
        <RowCopy value={url} label={copyLabel} />
      </div>
    </li>
  );
}

/** Popis adresa za upis na pločice: cijeli lokal i po jedan redak za svaki stol. Svaka adresa je ista kao u QR kodu tog stola. */
export function NfcUrlList({ venueUrl, rows, perTable = 1 }: { venueUrl: string; rows: NfcRow[]; perTable?: number }) {
  return (
    <div className="space-y-5" data-nfc-list>
      <div>
        <p className="label text-muted">Cijeli lokal (vrata, pult, bez stola)</p>
        <ul className="mt-1.5 border border-border bg-white">
          <UrlRow label="Lokal" url={venueUrl} copyLabel="Kopiraj adresu lokala" />
        </ul>
      </div>
      <div>
        <p className="label text-muted">
          Po stolovima ({rows.length})
        </p>
        <ul className="mt-1.5 border border-border bg-white" aria-label="Adrese po stolovima">
          {rows.map((r) => (
            <UrlRow key={r.table} label={`Stol ${r.table}`} hint={perTable > 1 ? `${piecesLabel(perTable)} s istim linkom` : undefined} url={r.url} copyLabel={`Kopiraj adresu za stol ${r.table}`} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3 text-[14px] leading-relaxed">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3">
          <span className="label mt-0.5 shrink-0 text-accent">{String(i + 1).padStart(2, "0")}</span>
          <span className="min-w-0">{t}</span>
        </li>
      ))}
    </ol>
  );
}

/** Upute za upis adrese na NTAG pločicu i provjeru. Kratke i bez izmišljenih tvrdnji o uređajima. */
export function NfcInstructions({ captureEnabled, venueUrl }: { captureEnabled: boolean; venueUrl: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="label text-muted">Upis na pločicu</h3>
        <div className="mt-3">
          <StepList
            items={[
              <>
                Uzmite praznu NFC pločicu ili naljepnicu tipa <b>NTAG213</b> ili <b>NTAG215</b>. Dovoljna je za jednu adresu.
              </>,
              <>
                Na mobitel instalirajte besplatnu aplikaciju za upis, npr. <b>NFC Tools</b> (Android i iPhone).
              </>,
              <>
                U aplikaciji odaberite <b>Write</b> (Zapiši), zatim <b>Add a record</b> (Dodaj zapis), <b>URL / URI</b>, zalijepite adresu iz popisa i potvrdite.
              </>,
              <>
                Pritisnite <b>Write</b> i prislonite mobitel na pločicu dok aplikacija ne javi da je upis uspio. Jedna adresa ide na jednu pločicu.
              </>,
              <>Isprobajte: zatvorite aplikaciju i prislonite mobitel na pločicu. Mora se otvoriti jelovnik.</>,
              <>
                Tek nakon uspješne provjere pločicu <b>zaključajte</b> (u NFC Tools: Other, Lock tag), da je nitko ne može prepisati. Zaključavanje je trajno, pa
                pločica poslije ne može dobiti novu adresu.
              </>,
              <>Označite pločicu brojem stola (olovkom ili naljepnicom) da ih ne zamijenite, pa je zalijepite uz stalak s QR kodom.</>,
            ]}
          />
        </div>
      </div>

      <div className="border-l-[3px] border-orange bg-orange-soft p-3 text-[13px] leading-relaxed">
        <b>Metal:</b> običnu pločicu ne lijepite izravno na metal (metalni stol ili stalak), jer tada ne radi. Za metalne površine uzmite pločice za metal
        (on-metal).
      </div>

      <div className="border-l-[3px] border-orange bg-orange-soft p-3 text-[13px] leading-relaxed">
        <b>Ako promijenite adresu jelovnika</b> u Postavkama, pločice koje ste već zaključali prestaju raditi i treba ih zamijeniti novima. Zato prije upisa
        provjerite da je adresa konačna.
      </div>

      <div>
        <h3 className="label text-muted">Provjera</h3>
        <div className="mt-3">
          <StepList
            items={
              captureEnabled
                ? [
                    <>
                      Otvorite adresu stola na mobitelu, npr. onu za stol 5 (ili prislonite mobitel na upisanu pločicu). Pogledajte da je u adresi na kraju{" "}
                      <code className="font-mono text-xs">?stol=5</code>.
                    </>,
                    <>
                      Upišite svoj broj mobitela i označite privolu. Pažnja: na taj broj može stići uobičajena poruka s molbom za Google recenziju, kao svakom gostu.
                    </>,
                    <>
                      U <b>Jelovnik, Gosti</b> mora se pojaviti vaš unos s oznakom <b>Stol 5</b>. Isto stoji i u kartici <b>Stolovi</b>.
                    </>,
                    <>Ako gost otvori jelovnik bez broja (poveznica „bez unosa broja”), ništa se ne sprema, pa se ni stol ne vidi. To je očekivano.</>,
                  ]
                : [
                    <>
                      Otvorite adresu stola na mobitelu (ili prislonite mobitel na upisanu pločicu). Jelovnik se mora odmah otvoriti.
                    </>,
                    <>
                      Ovaj lokal nema uključeno skupljanje brojeva, pa se oznaka stola <code className="font-mono text-xs">?stol=</code> ne sprema i ne vidi
                      se u Gostima. Pločica i QR kod rade jednako, samo bez brojanja po stolovima.
                    </>,
                  ]
            }
          />
        </div>
        <Button size="sm" variant="ghost" asChild className={cn("mt-3 h-11 px-0 sm:pointer-fine:h-11")}>
          <a href={venueUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Otvori jelovnik lokala
          </a>
        </Button>
      </div>
    </div>
  );
}

/**
 * Veličina kompleta: stolovi x komada po stolu = ukupno komada, naspram komada uključenih u postavljanje.
 * 1 komad = jedan stolni stalak s QR kodom + jedna NFC pločica. Iznosi dolaze iz lib/hospitality-plans.ts.
 */
export function PiecesSummary({ tables, perTable }: { tables: number; perTable: number }) {
  const t = pieceTotals(tables, perTable);
  return (
    <div className="border-l-[3px] border-orange bg-orange-soft p-3 text-[13px] leading-relaxed" data-pieces-summary>
      <p>
        Ukupno: <b>{t.tables}</b> × <b>{t.perTable}</b> = <b data-pieces-total>{piecesLabel(t.total)}</b> (stalak s QR kodom + NFC pločica). U postavljanje je uključeno{" "}
        {t.included}.
      </p>
      <p className="mt-1" data-pieces-extra>
        {t.extra > 0
          ? `Dodatnih ${piecesLabel(t.extra)}: ${formatEur(t.extraEur)} (${t.extra} × ${formatEur(HOSPITALITY_SETUP.extraPieceEur)}), uz godišnju uplatu ${formatEur(t.extraAnnualEur)} (${t.extra} × ${formatEur(HOSPITALITY_SETUP.extraPieceAnnualEur)}). Bez PDV-a.`
          : "Stane u uključeni komplet, bez doplate."}
      </p>
    </div>
  );
}
