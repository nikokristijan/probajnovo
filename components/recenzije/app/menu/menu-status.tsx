"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { CircleAlert, ExternalLink, Link2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { setMenuEnabledAction } from "@/lib/recenzije/actions/menu";
import { Button } from "@/components/recenzije/ui/button";
import { Switch } from "@/components/recenzije/ui/dialog";
import { Alert, Badge, Card, CardBody } from "@/components/recenzije/ui/primitives";
import { CopyLinkButton } from "@/components/recenzije/poster/poster-shared";
import type { GuestSummaryDTO } from "./menu-types";

/** Gornja kartica stranice: je li jelovnik uključen, javna adresa (kopiraj / otvori) i što još treba za rad. */
export function MenuStatus({
  publicUrl,
  enabled,
  readOnly,
  categories,
  items,
  hasExternalUrl,
  hasReviewUrl,
  delayMinutes,
  summary,
}: {
  publicUrl: string;
  enabled: boolean;
  readOnly: boolean;
  categories: number;
  items: number;
  hasExternalUrl: boolean;
  hasReviewUrl: boolean;
  delayMinutes: number;
  summary: GuestSummaryDTO;
}) {
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(enabled);

  function toggle(next: boolean) {
    start(async () => {
      setOn(next);
      const r = await setMenuEnabledAction(next);
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="label flex items-center gap-2 text-muted">
                <span className="size-1.5 shrink-0 bg-orange" aria-hidden />
                Stanje jelovnika
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px] font-bold">
                {on ? "Jelovnik je uključen" : "Jelovnik je isključen"}
                <Badge tone={on ? "green" : "neutral"} dot>
                  {on ? "Gosti ga vide" : "Gosti vide grešku"}
                </Badge>
              </p>
            </div>
            <Switch checked={on} disabled={readOnly || pending} onCheckedChange={toggle} label="Jelovnik je uključen" />
          </div>

          <div className="min-w-0">
            <p className="label text-muted">Javna adresa (na nju vodi QR kod)</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 border border-border bg-surface-2 py-1 pl-3 pr-1 sm:flex-nowrap">
              <Link2 className="size-4 shrink-0 text-muted" aria-hidden />
              <code className="min-w-0 flex-1 basis-full break-all py-1 font-mono text-xs sm:basis-auto sm:truncate sm:break-normal" title={publicUrl}>
                {publicUrl}
              </code>
              <CopyLinkButton value={publicUrl} />
              <Button size="sm" variant="ghost" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" aria-label="Otvori jelovnik u novoj kartici">
                  <ExternalLink /> Otvori
                </a>
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 sm:grid-cols-4">
            <Fact label="Kategorije" value={categories} />
            <Fact label="Stavke" value={items} />
            <Fact label="Gosti (7 dana)" value={summary.last7d} />
            <Fact label="Poruka nakon" value={`${delayMinutes} min`} />
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/recenzije/plakat?nacin=jelovnik">
                <QrCode /> QR kodovi za stolove
              </Link>
            </Button>
          </div>
        </CardBody>
      </Card>

      {!on && (
        <Alert tone="amber" icon={CircleAlert} title="Jelovnik je isključen">
          Gost koji skenira QR kod vidi stranicu s greškom i ne ostavlja broj. Uključite ga prije ispisa i postavljanja kodova.
        </Alert>
      )}
      {!hasReviewUrl && (
        <Alert
          tone="red"
          icon={CircleAlert}
          title="Nedostaje link za Google recenzije"
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link href="/recenzije/postavke">Dodaj link</Link>
            </Button>
          }
        >
          Brojevi se spremaju, ali se poruka s molbom za recenziju ne može poslati dok se ne upiše link.
        </Alert>
      )}
      {hasExternalUrl && (
        <Alert tone="blue" icon={CircleAlert} title="Gosti vide vaš vanjski jelovnik">
          Nakon unosa broja gost se šalje na adresu vašeg jelovnika (Postavke). Stavke koje ovdje uredite ne prikazuju se dok je ta adresa upisana.
        </Alert>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <dt className="label text-muted">{label}</dt>
      <dd className="tabular mt-1 text-xl font-bold leading-none">{value}</dd>
    </div>
  );
}
