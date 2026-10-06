import { Check, CircleAlert } from "lucide-react";
import { checkoutAction, portalAction } from "@/lib/recenzije/actions/settings";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/recenzije/ui/primitives";
import { env, integrations } from "@/lib/recenzije/env";
import { requireOrg } from "@/lib/recenzije/session";
import { formatDate, formatEur } from "@/lib/recenzije/status";
import { cn } from "@/lib/recenzije/utils";
import { listPlans, usage } from "@/lib/recenzije/services/billing";

export const metadata = { title: "Pretplata" };

const STATUS: Record<string, string> = {
  trialing: "proba",
  active: "aktivno",
  past_due: "kasni plaćanje",
  canceled: "otkazano",
  unpaid: "neplaćeno",
  incomplete: "nedovršeno",
};

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ checkout?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  const [plans, u] = await Promise.all([listPlans(), usage(ctx.org.id)]);
  const sub = u.subscription;
  const stripeReady = integrations.stripe();
  const canManage = ctx.role !== "MEMBER" && !ctx.org.isDemo;
  const pctUsed = Math.min(100, Math.round((u.smsUsed / Math.max(1, u.smsLimit)) * 100));
  const mail = (plan: string) =>
    `mailto:${env.salesEmail}?subject=${encodeURIComponent(`NOVO Recenzije: paket ${plan}`)}&body=${encodeURIComponent(
      `Bok, želim aktivirati paket ${plan} za tvrtku ${ctx.org.name} (${ctx.user.email}).`
    )}`;

  return (
    <>
      <PageHeader kicker="Postavke" title="Pretplata" description="Paketi, potrošnja SMS-ova i računi." />
      <div className="mb-6 space-y-3">
        {sp.checkout === "success" && <Alert tone="green" title="Hvala! Paket se ažurira čim Stripe potvrdi plaćanje." />}
        {sp.checkout === "cancelled" && <Alert tone="amber" title="Plaćanje je prekinuto. Ništa nije naplaćeno." />}
        {sp.error && <Alert tone="red" icon={CircleAlert} title={sp.error} />}
        {!stripeReady && !ctx.org.isDemo && (
          <Alert tone="blue" icon={CircleAlert} title="Paket aktivirate javljanjem NOVO-u">
            Pošaljite nam email klikom na paket. Aktiviramo ga isti dan, a račun stiže emailom (plaćanje virmanom).
          </Alert>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader
          title={u.plan ? `Paket ${u.plan.name}` : ctx.org.isDemo ? "Demo" : u.trialExpired ? "Proba je istekla" : "Besplatna proba"}
          description={
            sub?.currentPeriodEnd
              ? `${!sub.stripeSubscriptionId ? (u.active ? "Vrijedi do" : "Isteklo") : sub.cancelAtPeriodEnd ? "Završava" : "Obnavlja se"} ${formatDate(sub.currentPeriodEnd)}`
              : sub?.trialEndsAt
                ? `Proba ${u.trialExpired ? "je istekla" : "traje do"} ${formatDate(sub.trialEndsAt)}`
                : undefined
          }
          action={
            <Badge tone={u.active ? "green" : "amber"} dot>
              {sub ? (STATUS[sub.status] ?? sub.status) : "bez pretplate"}
            </Badge>
          }
        />
        <CardBody>
          <div className="flex justify-between text-sm">
            <span className="label text-muted">SMS ovaj mjesec</span>
            <span className="tabular font-mono">
              {u.smsUsed} / {u.smsLimit}
            </span>
          </div>
          <div className="mt-2 h-2 bg-surface-2">
            <div className={cn("h-full", pctUsed > 90 ? "bg-danger" : "bg-foreground")} style={{ width: `${pctUsed}%` }} />
          </div>
          {sub?.stripeCustomerId && canManage && stripeReady && (
            <form action={portalAction} className="mt-4">
              <Button variant="secondary" type="submit">
                Računi i način plaćanja
              </Button>
            </form>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = u.plan?.key === p.key;
          const featured = p.key === "growth";
          return (
            <Card key={p.id} className={cn("flex flex-col p-5", featured && "border-foreground")}>
              <div className="flex items-center justify-between">
                <h2 className="label">{p.name}</h2>
                {featured && <Badge tone="amber">Najpopularniji</Badge>}
              </div>
              <p className="mt-4">
                <span className="tabular text-4xl font-bold text-accent">{formatEur(p.priceMonthlyCents)}</span>
                <span className="text-sm text-muted"> / mj + PDV</span>
              </p>
              {p.description && <p className="mt-2 text-[13px] text-muted">{p.description}</p>}
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-orange" />
                    {f}
                  </li>
                ))}
              </ul>
              {stripeReady ? (
                <form action={checkoutAction.bind(null, p.key)} className="mt-5">
                  <Button type="submit" className="w-full" variant={featured ? "primary" : "secondary"} disabled={current || !canManage}>
                    {current ? "Trenutni paket" : `Odaberi ${p.name}`}
                  </Button>
                </form>
              ) : current ? (
                <Button className="mt-5 w-full" variant="secondary" disabled>
                  Trenutni paket
                </Button>
              ) : (
                <Button asChild className="mt-5 w-full" variant={featured ? "primary" : "secondary"}>
                  <a href={canManage ? mail(p.name) : "#"}>Aktiviraj {p.name} →</a>
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
