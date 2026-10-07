import Link from "next/link";
import { and, asc, count, desc, eq, isNull, isNotNull, lte, type SQL } from "drizzle-orm";
import { CalendarDays, Info, Plug, Reply as Link2, Star, StarHalf } from "lucide-react";
import { RatingLineChart, ReviewsBarChart } from "@/components/recenzije/app/charts";
import { KpiCard } from "@/components/recenzije/app/kpi";
import { Pagination } from "@/components/recenzije/app/pagination";
import { LinkClientSelect, ReplyBox, SyncReviewsButton } from "@/components/recenzije/app/reviews/review-tools";
import { AiSummaryCard } from "@/components/recenzije/reviews/ai-summary-card";
import { Button } from "@/components/recenzije/ui/button";
import { Alert, Avatar, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stars } from "@/components/recenzije/ui/primitives";
import { db } from "@/lib/recenzije/db";
import { clients, googleConnections, reviews } from "@/lib/recenzije/db/schema";
import { integrations } from "@/lib/recenzije/env";
import { requireOrg } from "@/lib/recenzije/session";
import { formatDate, timeAgo } from "@/lib/recenzije/status";
import { cn } from "@/lib/recenzije/utils";
import { reviewSeries, reviewStats } from "@/lib/recenzije/services/stats";

export const metadata = { title: "Recenzije" };
/** Server action AI sažetka izvršava se pod ovom rutom; Claude poziv ima do 45 s, pa zadana granica (10-15 s) ne smije biti kraća. */
export const maxDuration = 60;

const FILTERS = [
  { key: "", label: "Sve" },
  { key: "5", label: "5★" },
  { key: "4", label: "4★" },
  { key: "low", label: "1–3★" },
  { key: "linked", label: "Povezane" },
  { key: "unreplied", label: "Bez odgovora" },
];

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  const orgId = ctx.org.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 10;

  const where: SQL[] = [eq(reviews.organizationId, orgId)];
  if (sp.filter === "5") where.push(eq(reviews.rating, 5));
  if (sp.filter === "4") where.push(eq(reviews.rating, 4));
  if (sp.filter === "low") where.push(lte(reviews.rating, 3));
  if (sp.filter === "linked") where.push(isNotNull(reviews.clientId));
  if (sp.filter === "unreplied") where.push(isNull(reviews.repliedAt));

  const [stats, weekly, [conn], rows, [{ n: total }], clientOptions] = await Promise.all([
    reviewStats(orgId),
    reviewSeries(orgId, 180, "week"),
    db.select().from(googleConnections).where(eq(googleConnections.organizationId, orgId)).limit(1),
    db
      .select({ review: reviews, clientFirst: clients.firstName, clientLast: clients.lastName })
      .from(reviews)
      .leftJoin(clients, eq(clients.id, reviews.clientId))
      .where(and(...where))
      .orderBy(desc(reviews.reviewedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(reviews).where(and(...where)),
    db
      .select({ id: clients.id, first: clients.firstName, last: clients.lastName })
      .from(clients)
      .where(eq(clients.organizationId, orgId))
      .orderBy(asc(clients.firstName))
      .limit(500),
  ]);
  const options = clientOptions.map((c) => ({ id: c.id, name: `${c.first} ${c.last}`.trim() }));
  const connected = conn?.status === "CONNECTED";
  const canSync = !ctx.org.isDemo && (connected || (integrations.googlePlaces() && !!ctx.org.googlePlaceId));
  const avg = stats.average ? stats.average.toFixed(1) : "—";

  return (
    <>
      <PageHeader
        kicker="Google recenzije"
        title="Recenzije"
        description={
          ctx.org.googleSyncedAt
            ? `Zadnje preuzimanje s Googlea ${timeAgo(ctx.org.googleSyncedAt)}`
            : "Vaše Google recenzije i od kojih klijenata su stigle."
        }
        actions={<SyncReviewsButton disabled={!canSync} />}
      />

      <div className="mb-6 space-y-3">
        {ctx.org.isDemo ? (
          <Alert tone="blue" icon={Info} title="Primjeri recenzija">
            Ovo su demo podaci za Donald&apos;s Cooling. U vašem računu recenzije dolaze izravno s Googlea.
          </Alert>
        ) : !connected && !canSync ? (
          <Alert
            tone="amber"
            icon={Plug}
            title="Povežite Google Business Profile"
            action={
              <Button size="sm" variant="secondary" asChild>
                <Link href="/recenzije/postavke">Poveži</Link>
              </Button>
            }
          >
            Dok Google nije povezan, recenzije se ne mogu automatski provjeriti. Ovdje ništa nije procijenjeno: vidite samo ono što Google vrati.
          </Alert>
        ) : !connected ? (
          <Alert tone="blue" icon={Info} title="Djelomični podaci">
            Bez Business Profile veze Googleov Places API vraća samo 5 najnovijih recenzija. Povežite Business Profile da preuzmete sve.
          </Alert>
        ) : null}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Ukupno recenzija"
          value={ctx.org.googleReviewCount ?? stats.total}
          icon={Star}
          hint={ctx.org.googleReviewCount != null && ctx.org.googleReviewCount !== stats.total ? `${stats.total} spremljeno ovdje` : "Na Googleu"}
        />
        <KpiCard label="Prosječna ocjena" value={(ctx.org.googleRating?.toFixed(1) ?? avg).replace(".", ",")} icon={StarHalf} tone="green" hint="Google ocjena" />
        <KpiCard label="Novo ovaj mjesec" value={stats.thisMonth} icon={CalendarDays} hint="Od 1. u mjesecu" />
        <KpiCard label="Stopa odgovora" value={`${stats.total ? Math.round((stats.replied / stats.total) * 100) : 0}%`} icon={Link2} hint={`${stats.replied} odgovoreno · ${stats.matched} povezano`} />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recenzije kroz vrijeme" description="Po tjednu, zadnjih 6 mjeseci" />
          <CardBody className="pt-3">
            <ReviewsBarChart data={weekly} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ocjena kroz vrijeme" description="Tjedni prosjek" />
          <CardBody className="pt-3">
            <RatingLineChart data={weekly} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Raspodjela ocjena" />
          <CardBody className="space-y-2.5">
            {stats.distribution.map((d) => (
              <div key={d.rating} className="flex items-center gap-3 text-sm">
                <span className="tabular w-6 text-muted">{d.rating}★</span>
                <div className="h-2 flex-1 overflow-hidden bg-surface-2">
                  <div className="h-full bg-orange" style={{ width: `${stats.total ? (d.n / stats.total) * 100 : 0}%` }} />
                </div>
                <span className="tabular w-8 text-right text-muted">{d.n}</span>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="AI sažetak recenzija" description="Claude čita vaše spremljene recenzije, bez imena recenzenata" />
          <CardBody>
            {/* key po tvrtki: pri promjeni tvrtke stari sažetak ne smije ostati prikazan uz podatke druge tvrtke */}
            <AiSummaryCard key={orgId} aiConfigured={integrations.ai()} reviewCount={stats.total} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Sve recenzije" />
        <nav aria-label="Filter reviews" className="scrollbar-none mt-4 flex gap-1.5 overflow-x-auto px-5 pb-4">
          {FILTERS.map((f) => {
            const active = (sp.filter ?? "") === f.key;
            return (
              <Link
                key={f.key}
                href={f.key ? `/recenzije/ocjene?filter=${f.key}` : "/recenzije/ocjene"}
                scroll={false}
                className={cn(
                  "label whitespace-nowrap rounded-full border px-3 py-1.5",
                  active ? "border-foreground bg-foreground text-white" : "border-border-strong text-muted hover:text-foreground"
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
        {rows.length === 0 ? (
          <EmptyState
            icon={Star}
            title={stats.total === 0 ? "Još nema recenzija" : "Nema recenzija za ovaj filter"}
            description={stats.total === 0 ? "Kad povežete Google, preuzete recenzije pojavit će se ovdje." : undefined}
          />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {rows.map(({ review: r, clientFirst, clientLast }) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <Avatar name={r.reviewerName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-medium">{r.reviewerName}</p>
                      <Stars rating={r.rating} />
                      <span className="text-xs text-subtle">{formatDate(r.reviewedAt)}</span>
                      {r.source === "MANUAL" && <Badge>Ručno dodano</Badge>}
                      {r.clientId && (
                        <Badge tone="green">
                          {r.match === "NAME_MATCH" ? "Po imenu" : "Povezano"}: {clientFirst} {clientLast}
                        </Badge>
                      )}
                    </div>
                    {r.comment ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{r.comment}</p>
                    ) : (
                      <p className="mt-1.5 text-sm italic text-subtle">Samo ocjena, bez teksta.</p>
                    )}
                    {r.replyText && (
                      <div className="mt-3 border-l-2 border-orange bg-surface-2 px-3 py-2 text-[13px] text-foreground/80">
                        <span className="label mb-1 block text-muted">Vaš odgovor</span>
                        {r.replyText}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <LinkClientSelect reviewId={r.id} clientId={r.clientId} clients={options} />
                      <ReplyBox reviewId={r.id} canPost={connected && r.source === "GOOGLE"} existing={r.replyText} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/recenzije/ocjene" params={sp} />
      </Card>
    </>
  );
}
