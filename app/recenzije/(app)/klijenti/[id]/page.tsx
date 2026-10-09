import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  ExternalLink,
  Link2,
  Mail,
  MessageSquare,
  MousePointerClick,
  Phone,
  Star,
  Workflow,
  Wrench,
} from "lucide-react";
import { ActivityFeed } from "@/components/recenzije/app/activity-feed";
import {
  AddServiceDialog,
  ClientHeaderActions,
  CompleteServiceButton,
  CopyButton,
} from "@/components/recenzije/app/clients/client-actions";
import { Alert, Avatar, Badge, Card, CardBody, CardHeader, EmptyState, hitArea, Stars } from "@/components/recenzije/ui/primitives";
import { STEP_LABELS, formatWait } from "@/lib/recenzije/automation/types";
import { formatPhone } from "@/lib/recenzije/phone";
import { requireOrg } from "@/lib/recenzije/session";
import { MESSAGE_STATUS, REVIEW_STATUS, formatDate, timeAgo } from "@/lib/recenzije/status";
import { trackingUrl } from "@/lib/recenzije/services/tracking";
import { getClientDetail } from "@/lib/recenzije/services/clients";

export const metadata = { title: "Klijent" };

const RUN_TONE = { RUNNING: "blue", WAITING: "amber", COMPLETED: "green", FAILED: "red", CANCELLED: "neutral" } as const;
const RUN_LABEL = { RUNNING: "u tijeku", WAITING: "čeka", COMPLETED: "završeno", FAILED: "neuspjelo", CANCELLED: "otkazano" } as const;
const KIND_LABEL = {
  REVIEW_REQUEST: "Zahtjev za recenziju",
  FOLLOW_UP: "Podsjetnik",
  CAMPAIGN: "Kampanja",
  MANUAL: "Poruka",
  TEST: "Test",
  REPLY: "Odgovor",
} as const;

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ added?: string }>;
}) {
  const { id } = await params;
  const { added } = await searchParams;
  const ctx = await requireOrg();
  const d = await getClientDetail(ctx.org.id, id);
  if (!d) notFound();
  const { client } = d;
  const name = `${client.firstName} ${client.lastName}`.trim();
  const st = REVIEW_STATUS[client.reviewStatus];
  const reviewed = client.reviewStatus === "REVIEW_RECEIVED" || client.reviewStatus === "COMPLETED";
  const clicks = d.links.reduce((a, l) => a + l.clickCount, 0);
  const latestLink = d.links[0];

  return (
    <>
      <Link href="/recenzije/klijenti" className={`${hitArea} label mb-6 inline-flex items-center gap-1.5 text-muted hover:text-foreground`}>
        <ArrowLeft className="size-4" /> Klijenti
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={name} className="size-14 text-base" />
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-bold leading-tight">{name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone={st.tone} dot>
                {st.label}
              </Badge>
              {client.smsOptOut && (
                <Badge tone="red">
                  <Ban className="size-3" /> Odjavljen od SMS-a
                </Badge>
              )}
              <span className="text-xs text-subtle">Dodan {formatDate(client.createdAt)}</span>
            </div>
          </div>
        </div>
        <ClientHeaderActions
          clientId={client.id}
          reviewed={reviewed}
          optOut={client.smsOptOut}
          client={{ firstName: client.firstName, lastName: client.lastName, phone: client.phone, email: client.email, notes: client.notes }}
        />
      </div>

      {added && (
        <Alert tone="green" title={`Klijent ${client.firstName} je dodan`} className="mb-4">
          {d.runs.length > 0
            ? "Automatizacija je pokrenuta. Svaki korak pratite pod Status automatizacije."
            : "Automatizacija nije pokrenuta. Označite uslugu završenom ili odmah pošaljite zahtjev."}
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Contact */}
          <Card>
            <CardHeader title="Podaci o klijentu" />
            <CardBody>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 text-subtle" />
                  <div>
                    <dt className="label text-muted">Mobitel</dt>
                    <dd className="tabular mt-0.5">
                      <a href={`tel:${client.phone}`} className="hover:text-accent">
                        {formatPhone(client.phone)}
                      </a>
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 text-subtle" />
                  <div className="min-w-0">
                    <dt className="label text-muted">Email</dt>
                    <dd className="mt-0.5 truncate">{client.email ?? <span className="text-subtle">—</span>}</dd>
                  </div>
                </div>
                {client.notes && (
                  <div className="sm:col-span-2">
                    <dt className="label text-muted">Bilješke</dt>
                    <dd className="mt-1 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[13px] text-foreground/85">{client.notes}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader title="Povijest usluga" action={<AddServiceDialog clientId={client.id} />} />
            <CardBody className="pt-3">
              {d.services.length === 0 ? (
                <EmptyState icon={Wrench} title="Još nema usluga" description="Dodajte posao koji ste odradili za ovog klijenta." className="py-8" />
              ) : (
                <ul className="divide-y divide-border">
                  {d.services.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-surface-3 text-muted">
                        <Wrench className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted">
                          {formatDate(s.serviceDate)}
                          {s.technician ? ` · ${s.technician}` : ""}
                        </p>
                      </div>
                      {s.completedAt ? (
                        <Badge tone="green">Completed {formatDate(s.completedAt)}</Badge>
                      ) : (
                        <CompleteServiceButton serviceId={s.id} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Messages */}
          <Card>
            <CardHeader title="Poruke" description={`Ukupno: ${d.messages.length}`} />
            <CardBody className="pt-3">
              {d.messages.length === 0 ? (
                <EmptyState icon={MessageSquare} title="Još nema poruka" description="Poruke koje pošaljete ovom klijentu pojavit će se ovdje sa statusom isporuke." className="py-8" />
              ) : (
                <ul className="space-y-3">
                  {d.messages.map((m) => {
                    const ms = MESSAGE_STATUS[m.status];
                    const inbound = m.direction === "INBOUND";
                    return (
                      <li key={m.id} className={inbound ? "flex justify-start" : "flex justify-end"}>
                        <div
                          className={
                            "max-w-[min(100%,520px)] border p-3.5 " +
                            (inbound ? "border-border bg-surface-2" : "border-foreground bg-white")
                          }
                        >
                          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium text-muted">{inbound ? "Odgovor" : KIND_LABEL[m.kind]}</span>
                            <Badge tone={ms.tone}>{ms.label}</Badge>
                            <span className="text-subtle">{formatDate(m.createdAt, true)}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
                          {m.errorMessage && (
                            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-danger-soft px-2.5 py-2 text-xs text-danger">
                              <AlertTriangle className="mt-px size-3.5 shrink-0" /> Poruka nije poslana: {m.errorMessage}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {/* Review status */}
          <Card>
            <CardHeader title="Status recenzije" />
            <CardBody className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted">
                    <MousePointerClick className="size-3.5" /> Klikovi
                  </dt>
                  <dd className="tabular mt-1 text-lg font-semibold">{clicks}</dd>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted">
                    <MessageSquare className="size-3.5" /> Zadnja poruka
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{timeAgo(client.lastMessageAt)}</dd>
                </div>
              </dl>
              {client.nextFollowUpAt && !reviewed && (
                <p className="flex items-center gap-2 rounded-xl border border-warning/25 bg-warning-soft px-3 py-2 text-[13px] text-warning">
                  <CalendarClock className="size-4" /> Podsjetnik {timeAgo(client.nextFollowUpAt)}
                </p>
              )}
              {d.reviews.length > 0 ? (
                d.reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Stars rating={r.rating} />
                      <span className="text-xs text-subtle">{formatDate(r.reviewedAt)}</span>
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-foreground/85">“{r.comment}”</p>}
                    <p className="mt-2 text-[11px] text-subtle">
                      {r.match === "NAME_MATCH" ? "Povezano po točnom imenu recenzenta" : "Povezano ručno"}
                    </p>
                  </div>
                ))
              ) : reviewed ? (
                <p className="text-[13px] text-muted">
                  Označeno kao recenzirano {formatDate(client.reviewReceivedAt)}. Sama recenzija nije povezana: Google ne otkriva tko je napisao recenziju, pa povezujemo samo točna podudaranja imena.
                </p>
              ) : (
                <p className="flex items-start gap-2 text-[13px] text-muted">
                  <Star className="mt-0.5 size-4 shrink-0 text-subtle" />
                  Recenzija još nije povezana. Kad se ime na preuzetoj Google recenziji točno podudara s ovim klijentom, povezuje se automatski.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Review link */}
          <Card>
            <CardHeader title="Link za recenziju" />
            <CardBody className="space-y-3 text-sm">
              {latestLink ? (
                <>
                  <div>
                    <p className="label text-muted">Praćeni link poslan klijentu</p>
                    <div className="mt-1 flex items-center gap-1 rounded-lg bg-surface-2 py-1 pl-3 pr-1">
                      <Link2 className="size-3.5 shrink-0 text-subtle" />
                      <code className="min-w-0 flex-1 truncate text-xs">{trackingUrl(latestLink.token)}</code>
                      <CopyButton value={trackingUrl(latestLink.token)} />
                    </div>
                    <p className="mt-1 text-xs text-subtle">
                      {latestLink.firstClickedAt ? `Prvi klik ${timeAgo(latestLink.firstClickedAt)}` : "Još nije kliknut"}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-muted">Jedinstveni praćeni link nastaje kad se pošalje prvi zahtjev za recenziju.</p>
              )}
              {ctx.org.googleReviewUrl ? (
                <a href={ctx.org.googleReviewUrl} target="_blank" rel="noopener noreferrer" className={`${hitArea} inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline`}>
                  Otvori Google stranicu za recenziju <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <Link href="/recenzije/postavke" className="text-[13px] text-warning hover:underline">
                  Dodajte Google link u Postavkama →
                </Link>
              )}
            </CardBody>
          </Card>

          {/* Automations */}
          <Card>
            <CardHeader title="Status automatizacije" />
            <CardBody className="pt-3">
              {d.runs.length === 0 ? (
                <p className="flex items-start gap-2 text-[13px] text-muted">
                  <Workflow className="mt-0.5 size-4 shrink-0 text-subtle" /> Za ovog klijenta još se nije pokrenula nijedna automatizacija. Označite uslugu završenom da je pokrenete.
                </p>
              ) : (
                <ul className="space-y-3">
                  {d.runs.map(({ run, automationName, automationSteps, campaignName }) => {
                    const steps = automationSteps ?? [];
                    return (
                      <li key={run.id} className="rounded-xl border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{automationName ?? (campaignName ? `Kampanja: ${campaignName}` : "Automatizacija")}</p>
                          <Badge tone={RUN_TONE[run.status]}>{RUN_LABEL[run.status]}</Badge>
                        </div>
                        {steps.length > 0 && (
                          <ol className="mt-3 space-y-1.5">
                            {steps.map((s, i) => {
                              const done = i < run.stepIndex || run.status === "COMPLETED";
                              const current = i === run.stepIndex && (run.status === "WAITING" || run.status === "RUNNING");
                              return (
                                <li key={s.id} className="flex items-center gap-2 text-xs">
                                  <span
                                    className={
                                      "size-1.5 rounded-full " + (done ? "bg-foreground" : current ? "bg-orange" : "bg-surface-3")
                                    }
                                  />
                                  <span className={done ? "text-foreground/80" : current ? "text-warning" : "text-subtle"}>
                                    {STEP_LABELS[s.type]}
                                    {s.type === "wait" ? ` ${formatWait(s.minutes)}` : ""}
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                        {run.status === "WAITING" && (
                          <p className="mt-2 text-xs text-muted">Sljedeći korak {timeAgo(run.nextRunAt)}</p>
                        )}
                        {run.error && <p className="mt-2 text-xs text-danger">{run.error}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Vremenska crta" />
            <CardBody className="pt-3">
              <ActivityFeed items={d.activity} linkClients={false} absolute timeZone={ctx.org.timezone} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
