"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { QrCode, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { loadMoreGuestsAction } from "@/lib/recenzije/actions/menu";
import { Button } from "@/components/recenzije/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/recenzije/ui/primitives";
import type { GuestSummaryDTO, GuestView } from "./menu-types";

/** Gosti koji su ostavili broj na vratima jelovnika: brojke, popis s maskiranim brojem i stanje poruke. */
export function MenuGuests({
  summary,
  rows,
  hasMore,
  delayMinutes,
}: {
  summary: GuestSummaryDTO;
  rows: GuestView[];
  hasMore: boolean;
  delayMinutes: number;
}) {
  const router = useRouter();
  const [extra, setExtra] = useState<{ rows: GuestView[]; hasMore: boolean } | null>(null);
  const [loading, startLoad] = useTransition();
  const [refreshing, startRefresh] = useTransition();

  const seen = new Set(rows.map((r) => r.id));
  const all = [...rows, ...(extra?.rows ?? []).filter((r) => !seen.has(r.id))];
  const more = extra ? extra.hasMore : hasMore;

  function loadMore() {
    startLoad(async () => {
      const r = await loadMoreGuestsAction(all.length);
      if (!r.ok) return void toast.error(r.error);
      setExtra((prev) => ({ rows: [...(prev?.rows ?? []), ...r.data.rows], hasMore: r.data.hasMore }));
    });
  }

  function refresh() {
    startRefresh(() => {
      setExtra(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Zadnja 24 h" value={summary.last24h} />
        <Tile label="Zadnjih 7 dana" value={summary.last7d} />
        <Tile label="Poruka poslano" value={summary.sent} />
        <Tile label="Čeka slanje" value={summary.waiting} />
      </dl>

      <Card>
        <CardHeader
          title="Zadnji gosti"
          description={`Ukupno unosa: ${summary.total.toLocaleString("hr-HR")}. Poruka stiže otprilike ${delayMinutes} min nakon unosa, a noću (22:00 do 09:00) ujutro u 09:00.`}
          action={
            <Button size="sm" variant="ghost" onClick={refresh} loading={refreshing}>
              <RefreshCw /> Osvježi
            </Button>
          }
        />
        <CardBody className="px-0 pb-0">
          {all.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Još nema gostiju"
              description="Čim netko skenira QR kod i upiše broj mobitela, pojavit će se ovdje sa stanjem poruke."
              action={
                <Button variant="secondary" asChild>
                  <Link href="/recenzije/plakat?nacin=jelovnik">
                    <QrCode /> Ispiši QR kodove
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              <div className="label hidden grid-cols-[120px_minmax(0,1fr)_72px_minmax(0,1.2fr)] gap-3 border-y border-border bg-surface-2 px-5 py-2 text-muted sm:grid">
                <span>Vrijeme</span>
                <span>Broj</span>
                <span>Stol</span>
                <span>Poruka</span>
              </div>
              <ul className="divide-y divide-border border-t border-border sm:border-t-0">
                {all.map((g) => (
                  <li key={g.id} className="px-5 py-3 sm:grid sm:grid-cols-[120px_minmax(0,1fr)_72px_minmax(0,1.2fr)] sm:items-center sm:gap-x-3">
                    <div className="flex items-baseline justify-between gap-3 sm:contents">
                      <span className="tabular order-2 whitespace-nowrap text-[13px] text-muted sm:order-1">{g.whenLabel}</span>
                      <span className="order-1 whitespace-nowrap font-mono text-[13px] sm:order-2">{g.phone}</span>
                    </div>
                    <div className="mt-1.5 flex min-h-6 items-center justify-between gap-3 sm:order-3 sm:mt-0 sm:contents">
                      <span className="whitespace-nowrap text-[13px] text-muted sm:order-3">{g.table ? `Stol ${g.table}` : <span className="hidden sm:inline">-</span>}</span>
                      <span className="min-w-0 sm:order-4" title={g.detail ?? undefined}>
                        <Badge tone={g.tone} className="max-w-full whitespace-normal text-left leading-4">
                          {g.status}
                        </Badge>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {more && (
                <div className="border-t border-border p-4 text-center">
                  <Button variant="secondary" onClick={loadMore} loading={loading}>
                    Prikaži još
                  </Button>
                </div>
              )}
              <p className="border-t border-border px-5 py-3 text-xs text-muted">
                Brojevi su skriveni (vidljive su samo zadnje tri znamenke). Čuvaju se najviše 12 mjeseci, a gost se može odjaviti odgovorom STOP ili poveznicom u poruci.
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border border-border bg-surface p-4">
      <dt className="label truncate text-muted">{label}</dt>
      <dd className="tabular mt-2 text-3xl font-bold leading-none">{value.toLocaleString("hr-HR")}</dd>
    </div>
  );
}
