import { MousePointerClick, Percent, Send, Star } from "lucide-react";
import { AiInsights } from "@/components/recenzije/app/analytics/ai-insights";
import { ActivityChart, BreakdownBarChart, Funnel, ReviewsBarChart } from "@/components/recenzije/app/charts";
import { KpiCard } from "@/components/recenzije/app/kpi";
import { Badge, Card, CardBody, CardHeader, PageHeader, ScrollX } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";
import { byCampaign, byService, byTechnician, dashboardStats, funnel, messageSeries, reviewSeries } from "@/lib/recenzije/services/stats";

export const metadata = { title: "Analitika" };

/** Zaglavlje brojčanog stupca: na mobitelu kratki naziv da stanu svi stupci, od sm naviše puni. */
function Th({ short, full, last }: { short: string; full: string; last?: boolean }) {
  return (
    <th className={`tabular py-2 text-right font-normal ${last ? "" : "pr-2 sm:pr-3"}`}>
      <span className="sm:hidden" aria-hidden>
        {short}
      </span>
      <span className="sr-only sm:not-sr-only">{full}</span>
    </th>
  );
}

function BreakdownTable({ rows, label }: { rows: { key: string; clients: number; contacted: number; clicked: number; reviewed: number; conversion: number }[]; label: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">Još nema podataka.</p>;
  return (
    <ScrollX>
      <table className="w-full text-sm sm:min-w-[420px]">
        <thead className="label text-left text-muted">
          <tr className="border-b border-border">
            <th className="py-2 pr-2 font-normal sm:pr-3">{label}</th>
            <Th short="Klij." full="Klijenti" />
            <Th short="Posl." full="Poslano" />
            <Th short="Klik" full="Klik" />
            <Th short="Rec." full="Recenzija" />
            <Th short="Konv." full="Konv." last />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2.5 pr-2 sm:pr-3">{r.key}</td>
              <td className="tabular py-2.5 pr-2 text-right text-muted sm:pr-3">{r.clients}</td>
              <td className="tabular py-2.5 pr-2 text-right text-muted sm:pr-3">{r.contacted}</td>
              <td className="tabular py-2.5 pr-2 text-right text-muted sm:pr-3">{r.clicked}</td>
              <td className="tabular py-2.5 pr-2 text-right sm:pr-3">{r.reviewed}</td>
              <td className="tabular py-2.5 text-right font-medium text-accent">{r.conversion}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

export default async function AnalyticsPage() {
  const ctx = await requireOrg();
  const id = ctx.org.id;
  const [s, series, reviewsWeekly, stages, techs, svcs, camps] = await Promise.all([
    dashboardStats(id, 30),
    messageSeries(id, 30),
    reviewSeries(id, 90, "week"),
    funnel(id),
    byTechnician(id),
    byService(id),
    byCampaign(id),
  ]);
  return (
    <>
      <PageHeader kicker="Analitika" title="Analitika" description="Što radi: po danu, kampanji, serviseru i usluzi." />
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Poslani zahtjevi" value={s.requestsSent} icon={Send} hint="Zadnjih 30 dana" />
        <KpiCard label="Stopa klikova" value={`${s.clickRate}%`} icon={MousePointerClick} hint={`${s.linksClicked} klikova`} />
        <KpiCard label="Konverzija" value={`${s.conversionRate}%`} icon={Percent} tone="green" hint="Kontaktirani → recenzija" />
        <KpiCard label="Recenzije (30 d)" value={s.reviewsReceived} icon={Star} delta={s.reviewsReceived - s.reviewsPrev} hint="naspram 30 dana prije" />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Poruke, klikovi i greške" description="Po danu, zadnjih 30 dana" />
          <CardBody className="pt-3">
            <ActivityChart data={series} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Lijevak konverzije" />
          <CardBody>
            <Funnel stages={stages} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recenzije po tjednu" description="Zadnjih 90 dana" />
          <CardBody className="pt-3">
            <ReviewsBarChart data={reviewsWeekly} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="AI preporuke" description="Samo na temelju brojki iznad" />
          <CardBody>
            <AiInsights />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Po kampanji" />
        <CardBody>
          {camps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Još nema kampanja.</p>
          ) : (
            <ScrollX>
              <table className="w-full min-w-[520px] text-sm">
                <thead className="label text-left text-muted">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-normal">Kampanja</th>
                    <th className="py-2 pr-3 font-normal">Status</th>
                    <th className="py-2 pr-3 text-right font-normal">Primatelji</th>
                    <th className="py-2 pr-3 text-right font-normal">Poslano</th>
                    <th className="py-2 pr-3 text-right font-normal">Klik</th>
                    <th className="py-2 pr-3 text-right font-normal">Recenzija</th>
                    <th className="py-2 text-right font-normal">Konv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {camps.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 pr-3">{c.name}</td>
                      <td className="py-2.5 pr-3">
                        <Badge>{({ DRAFT: "skica", ACTIVE: "aktivna", PAUSED: "pauzirana", COMPLETED: "završena" } as const)[c.status]}</Badge>
                      </td>
                      <td className="tabular py-2.5 pr-3 text-right text-muted">{c.recipients}</td>
                      <td className="tabular py-2.5 pr-3 text-right text-muted">{c.sent}</td>
                      <td className="tabular py-2.5 pr-3 text-right text-muted">{c.clicked}</td>
                      <td className="tabular py-2.5 pr-3 text-right">{c.reviewed}</td>
                      <td className="tabular py-2.5 text-right font-medium text-accent">{c.conversion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Po serviseru" description="Prema zadnjem poslu svakog klijenta" />
          <CardBody className="space-y-4">
            {techs.length > 0 && <BreakdownBarChart data={techs} />}
            <BreakdownTable rows={techs} label="Serviser" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Po usluzi" description="Prema zadnjem poslu svakog klijenta" />
          <CardBody className="space-y-4">
            {svcs.length > 0 && <BreakdownBarChart data={svcs} />}
            <BreakdownTable rows={svcs} label="Usluga" />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
