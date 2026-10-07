import Link from "next/link";
import { env } from "@/lib/recenzije/env";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/recenzije/ui/primitives";
import { OPERATOR_EMAIL } from "@/lib/recenzije/operator";
import { describePlan } from "@/lib/recenzije/plan-view";
import { requireOrg } from "@/lib/recenzije/session";
import { formatDate } from "@/lib/recenzije/status";
import { cn } from "@/lib/recenzije/utils";
import { usage } from "@/lib/recenzije/services/billing";

export const metadata = { title: "Paket i razdoblje" };

export default async function SubscriptionPage() {
  const ctx = await requireOrg();
  const u = await usage(ctx.org.id);
  const view = describePlan(u, ctx.org.isDemo);
  const isOperator = ctx.user.email === OPERATOR_EMAIL;
  const pctUsed = Math.min(100, Math.round((u.smsUsed / Math.max(1, u.smsLimit)) * 100));

  return (
    <>
      <PageHeader kicker="Postavke" title="Paket i razdoblje" description="Pretplatom upravlja NOVO." />

      <Card className="max-w-2xl">
        <CardHeader
          title={view.title}
          action={
            <Badge tone={view.tone} dot>
              {view.statusLabel}
            </Badge>
          }
        />
        <CardBody className="space-y-6">
          {ctx.org.isDemo ? (
            <p className="text-sm text-muted">Ovo je primjer za razgledavanje. Paket i potrošnja SMS-ova prikazuju se kod stvarnih tvrtki.</p>
          ) : (
            <>
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="label text-muted">Paket</dt>
                  <dd className="mt-1 break-words">{u.plan?.name ?? "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="label text-muted">Status</dt>
                  <dd className="mt-1">{view.statusLabel}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="label text-muted">{view.endLabel ?? "Razdoblje"}</dt>
                  <dd className="mt-1">{view.endDate ? formatDate(view.endDate) : "—"}</dd>
                </div>
              </dl>

              <div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="label text-muted">SMS ovaj mjesec</span>
                  <span className="tabular font-mono">
                    {u.smsUsed} / {u.smsLimit}
                  </span>
                </div>
                <div className="mt-2 h-2 bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={u.smsLimit} aria-valuenow={Math.min(u.smsUsed, u.smsLimit)} aria-label="Potrošeni SMS-ovi">
                  <div className={cn("h-full", pctUsed > 90 ? "bg-danger" : "bg-foreground")} style={{ width: `${pctUsed}%` }} />
                </div>
                {!u.active && <p className="mt-3 text-[13px] text-warning">Paket nije aktivan, pa je slanje poruka pauzirano.</p>}
                {u.active && u.smsUsed >= u.smsLimit && <p className="mt-3 text-[13px] text-warning">Mjesečni limit SMS-ova je potrošen, pa je slanje do idućeg mjeseca pauzirano.</p>}
              </div>
            </>
          )}

          <p className="border-t border-border pt-4 text-[13px] text-muted">
            Pretplatom upravlja NOVO.{" "}
            {isOperator ? (
              <>
                Paket i razdoblje mijenjate u{" "}
                <Link href="/admin/recenzije" className="font-bold text-foreground underline underline-offset-4">
                  adminu
                </Link>
                .
              </>
            ) : (
              <>
                Za promjenu paketa ili pitanja o računu javite se na{" "}
                <a href={`mailto:${env.salesEmail}`} className="font-bold text-foreground underline underline-offset-4">
                  {env.salesEmail}
                </a>
                .
              </>
            )}
          </p>
        </CardBody>
      </Card>
    </>
  );
}
