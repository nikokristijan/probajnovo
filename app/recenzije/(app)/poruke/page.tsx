import Link from "next/link";
import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { AlertTriangle, Inbox } from "lucide-react";
import { MessageBuilder } from "@/components/recenzije/app/messages/message-builder";
import { Pagination } from "@/components/recenzije/app/pagination";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/recenzije/ui/primitives";
import { db } from "@/lib/recenzije/db";
import { clients, messageTemplates, messages, type MessageStatus } from "@/lib/recenzije/db/schema";
import { env, integrations } from "@/lib/recenzije/env";
import { smsProvider } from "@/lib/recenzije/services/sms";
import { formatPhone } from "@/lib/recenzije/phone";
import { requireOrg } from "@/lib/recenzije/session";
import { MESSAGE_STATUS, formatDate } from "@/lib/recenzije/status";
import { cn } from "@/lib/recenzije/utils";

export const metadata = { title: "Poruke" };

const STATUS_FILTERS: { key: string; label: string; statuses?: MessageStatus[] }[] = [
  { key: "", label: "Sve" },
  { key: "DELIVERED", label: "Isporučeno", statuses: ["DELIVERED"] },
  { key: "SENT", label: "Poslano", statuses: ["SENT", "QUEUED"] },
  { key: "FAILED", label: "Neuspjelo", statuses: ["FAILED", "UNDELIVERED"] },
  { key: "RECEIVED", label: "Odgovori", statuses: ["RECEIVED"] },
];

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  const orgId = ctx.org.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 15;
  const filter = STATUS_FILTERS.find((f) => f.key === (sp.status ?? "")) ?? STATUS_FILTERS[0];
  const where: SQL[] = [eq(messages.organizationId, orgId)];
  if (filter.statuses) where.push(inArray(messages.status, filter.statuses));

  const [templates, clientRows, log, [{ n: total }]] = await Promise.all([
    db.select().from(messageTemplates).where(eq(messageTemplates.organizationId, orgId)).orderBy(desc(messageTemplates.updatedAt)),
    db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        optOut: clients.smsOptOut,
        service: sql<string | null>`(select s.name from nr_services s where s.client_id = "nr_clients"."id" order by s.service_date desc limit 1)`,
        technician: sql<string | null>`(select s.technician from nr_services s where s.client_id = "nr_clients"."id" order by s.service_date desc limit 1)`,
        serviceDate: sql<string | null>`(select s.service_date from nr_services s where s.client_id = "nr_clients"."id" order by s.service_date desc limit 1)`,
      })
      .from(clients)
      .where(eq(clients.organizationId, orgId))
      .orderBy(desc(clients.createdAt))
      .limit(500),
    db
      .select({ m: messages, first: clients.firstName, last: clients.lastName })
      .from(messages)
      .leftJoin(clients, eq(clients.id, messages.clientId))
      .where(and(...where))
      .orderBy(desc(messages.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(messages).where(and(...where)),
  ]);

  return (
    <>
      <PageHeader kicker="Poruke" title="Poruke" description="Napišite, pregledajte i pošaljite SMS. Svaka poruka se bilježi sa statusom isporuke." />
      <MessageBuilder
        templates={templates.map((t) => ({ id: t.id, name: t.name, kind: t.kind, body: t.body }))}
        clients={clientRows.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          firstName: c.firstName,
          lastName: c.lastName,
          service: c.service,
          technician: c.technician,
          serviceDate: c.serviceDate ? new Date(c.serviceDate) : null,
          optOut: c.optOut,
        }))}
        businessName={ctx.org.name}
        previewLink={`${env.appUrl}/r/Ab3xK9pQ2m`}
        status={{ ai: integrations.ai(), sms: smsProvider(ctx.org) !== null, demo: ctx.org.isDemo, reviewUrl: !!ctx.org.googleReviewUrl }}
      />

      <Card className="mt-8 overflow-hidden" id="log">
        <CardHeader title="Sve poruke" description="Poslane poruke i odgovori klijenata" />
        <nav aria-label="Filtriraj poruke" className="scrollbar-none mt-4 flex gap-1.5 overflow-x-auto px-5 pb-4">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key ? `/recenzije/poruke?status=${f.key}#log` : "/recenzije/poruke#log"}
              scroll={false}
              className={cn(
                "label whitespace-nowrap rounded-full border px-3 py-1.5",
                filter.key === f.key ? "border-foreground bg-foreground text-white" : "border-border-strong text-muted hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {log.length === 0 ? (
          <EmptyState icon={Inbox} title={filter.key === "FAILED" ? "Nema neuspjelih poruka" : "Još nema poruka"} description="Poruke se ovdje pojavljuju čim se pošalju." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {log.map(({ m, first, last }) => {
              const st = MESSAGE_STATUS[m.status];
              const who = first ? `${first} ${last ?? ""}`.trim() : formatPhone(m.toNumber);
              return (
                <li key={m.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex shrink-0 items-center gap-2 sm:w-52">
                    {m.clientId ? (
                      <Link href={`/recenzije/klijenti/${m.clientId}`} className="truncate text-sm font-medium hover:text-accent">
                        {who}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium">{who}</span>
                    )}
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-foreground/80">{m.body}</p>
                    {m.errorMessage && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-danger">
                        <AlertTriangle className="mt-px size-3.5 shrink-0" /> Poruka nije poslana: {m.errorMessage}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-subtle sm:w-32 sm:text-right">
                    {m.direction === "INBOUND" ? "Primljeno " : ""}
                    {formatDate(m.createdAt, true)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/recenzije/poruke" params={sp} />
      </Card>
    </>
  );
}
