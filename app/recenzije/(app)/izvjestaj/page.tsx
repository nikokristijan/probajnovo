import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PrintButton } from "@/components/recenzije/app/print-button";
import { Button } from "@/components/recenzije/ui/button";
import { Card, PageHeader, Stars } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";
import { monthlyReport } from "@/lib/recenzije/services/stats";

export const metadata = { title: "Mjesečni izvještaj" };

const MONTHS = ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"];

function currentMonth(tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: tz }).format(new Date());
  const [y, m] = parts.split("-").map(Number);
  return { y, m };
}

function shift(y: number, m: number, d: number) {
  const t = y * 12 + (m - 1) + d;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="border border-border bg-white p-5">
      <p className="label text-muted">{label}</p>
      <p className="tabular mt-2 text-4xl font-bold text-accent">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

/**
 * Mjesečni izvještaj za tvrtku: NOVO ga otvori, klikne "Spremi kao PDF" i
 * pošalje klijentu. Samo stvarne brojke iz baze za odabrani mjesec.
 */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ mjesec?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  const now = currentMonth(ctx.org.timezone);
  const match = /^(\d{4})-(\d{2})$/.exec(sp.mjesec ?? "");
  let y = match ? Number(match[1]) : now.y;
  let m = match ? Number(match[2]) : now.m;
  if (m < 1 || m > 12 || y * 12 + m > now.y * 12 + now.m) ({ y, m } = now);
  const r = await monthlyReport(ctx.org.id, y, m, ctx.org.timezone);
  const prev = shift(y, m, -1);
  const next = shift(y, m, 1);
  const isCurrent = y === now.y && m === now.m;
  const key = (p: { y: number; m: number }) => `${p.y}-${String(p.m).padStart(2, "0")}`;
  const monthLabel = `${MONTHS[m - 1]} ${y}.`;
  const rating = ctx.org.googleRating ?? r.averageRating;

  return (
    <>
      <div data-noprint>
        <PageHeader
          kicker="Izvještaj"
          title="Mjesečni izvještaj"
          description="Pošaljite ga klijentu kao PDF: što je poslano, tko je kliknuo i koliko je stiglo recenzija."
          actions={
            <>
              <Button variant="secondary" asChild>
                <Link href={`/recenzije/izvjestaj?mjesec=${key(prev)}`} aria-label="Prethodni mjesec">
                  <ChevronLeft />
                </Link>
              </Button>
              {!isCurrent && (
                <Button variant="secondary" asChild>
                  <Link href={`/recenzije/izvjestaj?mjesec=${key(next)}`} aria-label="Sljedeći mjesec">
                    <ChevronRight />
                  </Link>
                </Button>
              )}
              <PrintButton />
            </>
          }
        />
      </div>

      <article className="report mx-auto max-w-[860px] border border-foreground bg-white p-6 sm:p-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="label text-accent">NOVO Recenzije · izvještaj</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">{ctx.org.name}</h1>
            <p className="mt-1 text-[15px] capitalize text-muted">{monthLabel}{isCurrent ? " (do danas)" : ""}</p>
          </div>
          {rating != null && (
            <div className="text-right">
              <p className="label text-muted">Ocjena na Googleu</p>
              <p className="tabular text-3xl font-bold">{rating.toFixed(1).replace(".", ",")}</p>
              {ctx.org.googleReviewCount != null && <p className="text-xs text-muted">{ctx.org.googleReviewCount} recenzija ukupno</p>}
            </div>
          )}
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric label="Poslani zahtjevi" value={r.requests} note={r.followUps ? `+ ${r.followUps} podsjetnika` : undefined} />
          <Metric label="Kliknulo na link" value={r.clicked} note={r.requests ? `${r.clickRate}% primatelja` : undefined} />
          <Metric
            label="Nove recenzije"
            value={r.reviews}
            note={r.reviews ? `${r.fiveStar} s 5 zvjezdica${r.averageRating ? ` · prosjek ${r.averageRating.toFixed(1).replace(".", ",")}` : ""}` : undefined}
          />
        </section>

        <section className="mt-8">
          <h2 className="label text-muted">Što su klijenti napisali</h2>
          {r.topReviews.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Ovaj mjesec još nema novih recenzija s tekstom.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {r.topReviews.map((t, i) => (
                <li key={i} className="border-l-2 border-orange bg-surface-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t.name}</span>
                    <Stars rating={t.rating} />
                  </div>
                  <p className="mt-1 text-[15px] leading-relaxed text-foreground/85">„{t.comment}”</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 grid gap-2 border-t border-border pt-6 text-sm text-muted sm:grid-cols-3">
          <p>Novi klijenti u sustavu: <b className="tabular text-foreground">{r.newClients}</b></p>
          <p>Neisporučene poruke: <b className="tabular text-foreground">{r.failed}</b></p>
          <p>Odjave (STOP): <b className="tabular text-foreground">{r.optOuts}</b></p>
        </section>

        <footer className="mt-8 border-t border-border pt-4 text-xs text-subtle">
          Pripremio NOVO · probajnovo.com · Brojke su izravno iz sustava za {monthLabel}
        </footer>
      </article>

      {r.requests === 0 && r.reviews === 0 && (
        <Card className="mx-auto mt-4 max-w-[860px] p-4 text-sm text-muted" data-noprint>
          Za ovaj mjesec nema poslanih poruka. Uvezite klijente u Klijentima pa će se izvještaj sam popuniti.
        </Card>
      )}
    </>
  );
}
