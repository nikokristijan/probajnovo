"use client";

import Link from "next/link";
import { useState } from "react";
import { QrCode, TableProperties } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/recenzije/ui/primitives";
import { guestsLeftNumber, WEEKDAYS_LONG, WEEKDAYS_SHORT } from "@/lib/recenzije/menu-stats-format";
import { cn } from "@/lib/recenzije/utils";
import type { StatsDTO } from "./menu-types";

const nf = (n: number) => n.toLocaleString("hr-HR");

/** Vodoravna traka čiju širinu čini CSS (postotak najveće vrijednosti); sama po sebi je ukrasna, tekst je uz nju. */
function Bar({ value, max, tone = "bg-foreground" }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <span className="block h-2.5 w-full bg-surface-3" aria-hidden>
      <span className={cn("block h-2.5", tone)} style={{ width: `${pct}%` }} />
    </span>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 border border-border bg-surface p-4">
      <dt className="label truncate text-muted">{label}</dt>
      <dd className="tabular mt-2 text-3xl font-bold leading-none">{value}</dd>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Stolovi: koliko je gostiju ostavilo broj po stolu, po danu u tjednu i po satu (u vremenskoj zoni tvrtke), za zadnjih 7 ili 30 dana.
 * Brojeke dolaze s poslužitelja (services/menu-stats.ts); prebacivanje razdoblja je samo stanje u pregledniku. Trake su CSS (bez biblioteke za
 * grafikone), a uz svaku traku stoji i broj kao običan tekst, pa grafikon ne ovisi o boji ni o vidu. Oznake stolova su nepouzdan unos
 * (?stol=), pa se ispisuju samo kao običan tekst koji React escapea (poslužitelj ih je već sveo na A-Z, 0-9, razmak i crticu).
 */
export function MenuTables({ stats7, stats30, captureEnabled }: { stats7: StatsDTO; stats30: StatsDTO; captureEnabled: boolean }) {
  const [days, setDays] = useState<7 | 30>(7);
  const s = days === 7 ? stats7 : stats30;
  const maxTable = Math.max(1, ...s.tables.map((t) => t.count), s.withoutTable, s.otherTables);
  const maxDay = Math.max(1, ...s.byWeekday);
  const maxHour = Math.max(1, ...s.byHour);
  const withTable = s.total - s.withoutTable;
  const hoursShown = s.byHour.map((n, h) => ({ h, n })).filter((x) => x.n > 0);

  return (
    <div className="space-y-4">
      {!captureEnabled && (
        <p className="border-l-[3px] border-border-strong bg-surface-2 p-3 text-[13px] text-foreground/80" role="note">
          <b>Skupljanje brojeva je isključeno.</b> Novi podaci se ne bilježe; ovdje je samo ono što je ostalo od ranije.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Stolovi</h2>
          <p className="text-[13px] text-muted">Gosti koji su ostavili broj na vratima jelovnika, po stolu i po vremenu.</p>
        </div>
        <div role="group" aria-label="Razdoblje" className="inline-grid grid-cols-2 border border-foreground">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={cn("label min-h-11 min-w-24 cursor-pointer px-3 transition-colors", days === d ? "bg-foreground text-white" : "bg-white text-foreground hover:bg-surface-2")}
            >
              {d} dana
            </button>
          ))}
        </div>
      </div>

      {s.total === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={TableProperties}
              title={`Nema podataka za zadnjih ${days} dana`}
              description="Brojke se pojave kad gosti skeniraju QR kod i ostave broj mobitela. Da bi se vidjelo i koji stol, ispišite QR kodove s brojem stola (plakat, način Jelovnik)."
              action={
                <Button variant="secondary" asChild>
                  <Link href="/recenzije/plakat?nacin=jelovnik">
                    <QrCode /> QR kodovi po stolovima
                  </Link>
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Gostiju" value={nf(s.total)} hint={`zadnjih ${days} dana`} />
            <Tile label="Brojeva" value={nf(s.uniqueNumbers)} hint="različitih mobitela" />
            <Tile label="Sa stolom" value={nf(withTable)} hint={s.withoutTable > 0 ? `${nf(s.withoutTable)} bez stola` : "svi imaju stol"} />
            <Tile label="Najviše u" value={s.peakHour === null ? "-" : `${s.peakHour} h`} hint={s.peakWeekday === null ? undefined : `najprometniji dan: ${WEEKDAYS_LONG[s.peakWeekday]}`} />
          </dl>

          <Card>
            <CardHeader title="Po stolu" description={s.tables.length ? "Broj gostiju koji su ostavili broj, po oznaci stola iz QR koda." : "Nijedan unos nema oznaku stola. Ispišite QR kodove s brojem stola da se ovdje vidi razlika."} />
            <CardBody className="pt-3">
              <ul className="space-y-3">
                {s.tables.map((t) => (
                  <li key={t.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words font-medium">Stol {t.label}</span>
                      <span className="tabular shrink-0 font-bold">{nf(t.count)}</span>
                    </div>
                    <Bar value={t.count} max={maxTable} />
                    <span className="sr-only">{guestsLeftNumber(t.count)}</span>
                  </li>
                ))}
                {s.otherTables > 0 && (
                  <li>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm text-muted">
                      <span>Ostali stolovi</span>
                      <span className="tabular shrink-0 font-bold">{nf(s.otherTables)}</span>
                    </div>
                    <Bar value={s.otherTables} max={maxTable} tone="bg-border-strong" />
                  </li>
                )}
                {s.withoutTable > 0 && (
                  <li>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm text-muted">
                      <span>Bez stola</span>
                      <span className="tabular shrink-0 font-bold">{nf(s.withoutTable)}</span>
                    </div>
                    <Bar value={s.withoutTable} max={maxTable} tone="bg-border-strong" />
                  </li>
                )}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Po danu u tjednu" description="Vrijeme je u zoni vaše tvrtke." />
            <CardBody className="pt-3">
              <ol className="grid grid-cols-7 gap-1.5 sm:gap-3" aria-label="Gosti po danu u tjednu">
                {s.byWeekday.map((n, i) => (
                  <li key={WEEKDAYS_SHORT[i]} className="flex min-w-0 flex-col items-center gap-1.5">
                    <span className="tabular text-xs font-bold">{nf(n)}</span>
                    <span className="flex h-24 w-full items-end bg-surface-3" aria-hidden>
                      <span className={cn("block w-full", i === s.peakWeekday ? "bg-foreground" : "bg-border-strong")} style={{ height: `${n > 0 ? Math.max(4, Math.round((n / maxDay) * 100)) : 0}%` }} />
                    </span>
                    <span className="label text-muted" title={WEEKDAYS_LONG[i]}>
                      {WEEKDAYS_SHORT[i]}
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Po satu" description={s.peakHour === null ? undefined : `Najviše gostiju u ${s.peakHour} h (${nf(s.byHour[s.peakHour])}).`} />
            <CardBody className="pt-3">
              <div
                role="img"
                aria-label={`Gosti po satu u danu. ${hoursShown.map((x) => `${x.h} h: ${x.n}`).join(", ")}.`}
                className="grid h-24 grid-cols-[repeat(24,minmax(0,1fr))] items-end gap-px bg-surface-3"
              >
                {s.byHour.map((n, h) => (
                  <span key={h} className={cn("block w-full", h === s.peakHour ? "bg-foreground" : "bg-border-strong")} style={{ height: `${n > 0 ? Math.max(4, Math.round((n / maxHour) * 100)) : 0}%` }} />
                ))}
              </div>
              <div className="mt-1 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px text-[10px] leading-4 text-muted" aria-hidden>
                {s.byHour.map((_, h) => (
                  <span key={h} className="text-center">
                    {h % 6 === 0 ? h : ""}
                  </span>
                ))}
              </div>
              <details className="mt-3 text-[13px]">
                <summary className="label min-h-9 cursor-pointer select-none py-2 text-muted">Brojke po satima</summary>
                <ul className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                  {hoursShown.map((x) => (
                    <li key={x.h} className="flex justify-between gap-2">
                      <span>{x.h} h</span>
                      <span className="tabular font-bold">{nf(x.n)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Zahtjevi za recenziju" description="Što se dogodilo s porukom za svakog gosta u ovom razdoblju." />
            <CardBody className="pt-3">
              <dl className="divide-y divide-border border border-border">
                {[
                  ["Zakazano", s.requests.scheduled, "poruka čeka slanje ili je poslana"],
                  ["Poslano", s.requests.sent, "poruka je stvarno otišla"],
                  ["Preskočeno", s.requests.skipped, "već kontaktiran, odjava, limit i slično"],
                ].map(([label, value, hint]) => (
                  <div key={label as string} className="flex items-baseline justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <dt className="text-sm font-medium">{label}</dt>
                      <p className="text-xs text-muted">{hint}</p>
                    </div>
                    <dd className="tabular shrink-0 text-2xl font-bold leading-none">{nf(value as number)}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
