import Link from "next/link";
import { eq } from "drizzle-orm";
import { AlertTriangle, CalendarClock, MousePointerClick, Percent, Plug, Send, Smartphone, Star, Users } from "lucide-react";
import { ActivityChart, Funnel } from "@/components/recenzije/app/charts";
import { ActivityFeed } from "@/components/recenzije/app/activity-feed";
import { AddClientDialog } from "@/components/recenzije/app/clients/add-client-dialog";
import { KpiCard } from "@/components/recenzije/app/kpi";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/recenzije/ui/primitives";
import { db } from "@/lib/recenzije/db";
import { googleConnections } from "@/lib/recenzije/db/schema";
import { OPERATOR_EMAIL } from "@/lib/recenzije/operator";
import { requireOrg } from "@/lib/recenzije/session";
import { smsProvider } from "@/lib/recenzije/services/sms";
import { dashboardStats, funnel, messageSeries, recentActivity } from "@/lib/recenzije/services/stats";

export const metadata = { title: "Pregled" };

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
  return h < 12 ? "Dobro jutro" : h < 18 ? "Dobar dan" : "Dobra večer";
}

export default async function DashboardPage() {
  const ctx = await requireOrg();
  const orgId = ctx.org.id;
  const isOperator = ctx.user.email === OPERATOR_EMAIL;
  const [stats, activity, series, stages, [conn]] = await Promise.all([
    dashboardStats(orgId, 30),
    recentActivity(orgId, 10),
    messageSeries(orgId, 30),
    funnel(orgId),
    db.select().from(googleConnections).where(eq(googleConnections.organizationId, orgId)).limit(1),
  ]);
  const smsReady = smsProvider(ctx.org) !== null;
  const reviewDelta = stats.reviewsReceived - stats.reviewsPrev;

  return (
    <>
      <PageHeader
        kicker={ctx.org.name}
        title={`${greeting(ctx.org.timezone)}${ctx.user.name && !isOperator ? `, ${ctx.user.name.split(" ")[0]}` : ""}`}
        description="Kako su prošli zahtjevi za recenzije u zadnjih 30 dana."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/recenzije/poruke">
                <Send /> Nova poruka
              </Link>
            </Button>
            <AddClientDialog openToClient />
          </>
        }
      />

      <div className="mb-8 space-y-3">
        {!ctx.org.googleReviewUrl && !conn && (
          <Alert
            tone="amber"
            icon={Plug}
            title="Nedostaje Google link za recenzije"
            action={
              <Button size="sm" variant="secondary" asChild>
                <Link href="/recenzije/postavke">Postavke</Link>
              </Button>
            }
          >
            Zahtjevi za recenziju vode na taj link, pa se bez njega ne mogu poslati.
          </Alert>
        )}
        {!smsReady && !ctx.org.isDemo && (
          <Alert
            tone="amber"
            icon={Smartphone}
            title="SMS se zasad ne mogu slati"
            action={
              isOperator ? (
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/admin/recenzije">Otvori admin</Link>
                </Button>
              ) : undefined
            }
          >
            SMS pošiljatelj nije postavljen.{isOperator ? "" : " Javite se NOVO-u."}
          </Alert>
        )}
        {stats.failedMessages > 0 && (
          <Alert
            tone="red"
            icon={AlertTriangle}
            title={`Neuspjelo slanje: ${stats.failedMessages} ${stats.failedMessages === 1 ? "poruka" : "poruke"}`}
            action={
              <Button size="sm" variant="secondary" asChild>
                <Link href="/recenzije/poruke?status=FAILED#log">Pogledaj</Link>
              </Button>
            }
          >
            Najčešće je kriv neispravan broj. Ispravite broj i ponovno pošaljite sa stranice klijenta.
          </Alert>
        )}
      </div>

      <section aria-label="Ključni pokazatelji" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Klijenti" value={stats.clients} icon={Users} hint={`+${stats.clientsNew} u 30 dana`} />
        <KpiCard label="Poslani zahtjevi" value={stats.requestsSent} icon={Send} hint="Zadnjih 30 dana" />
        <KpiCard label="Klikovi na link" value={stats.linksClicked} icon={MousePointerClick} hint={`${stats.clickRate}% klikne`} />
        <KpiCard label="Nove recenzije" value={stats.reviewsReceived} icon={Star} tone="green" delta={reviewDelta} hint="naspram 30 dana prije" />
        <KpiCard label="Konverzija" value={`${stats.conversionRate}%`} icon={Percent} tone="green" hint="Kontaktirani koji su ostavili recenziju" />
        <KpiCard
          label="Prosječna ocjena"
          value={stats.averageRating ? stats.averageRating.toFixed(1).replace(".", ",") : "—"}
          icon={Star}
          hint={stats.totalReviews ? `${stats.totalReviews} recenzija ukupno` : "Recenzije još nisu preuzete"}
        />
        <KpiCard label="Zakazani podsjetnici" value={stats.followUpsScheduled} icon={CalendarClock} tone="amber" hint="Čekaju slanje" />
        <KpiCard label="Neuspjele poruke" value={stats.failedMessages} icon={AlertTriangle} tone={stats.failedMessages ? "red" : "neutral"} hint="Zadnjih 30 dana" />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Poruke i klikovi" description="Po danu, zadnjih 30 dana" />
          <CardBody className="pt-4">
            <ActivityChart data={series} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Lijevak recenzija" description="Od početka" />
          <CardBody>
            <Funnel stages={stages} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Zadnje aktivnosti"
          action={
            <Link href="/recenzije/klijenti" className="label text-muted hover:text-foreground">
              Svi klijenti →
            </Link>
          }
        />
        <CardBody className="pt-3">
          <ActivityFeed items={activity} timeZone={ctx.org.timezone} />
        </CardBody>
      </Card>
    </>
  );
}
