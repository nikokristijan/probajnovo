import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Workflow } from "lucide-react";
import { AutomationToggle, TemplateCard } from "@/components/recenzije/app/automations/automation-list";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/recenzije/ui/primitives";
import { db } from "@/lib/recenzije/db";
import { automationRuns, automations } from "@/lib/recenzije/db/schema";
import { AUTOMATION_TEMPLATES } from "@/lib/recenzije/automation/templates";
import { STEP_LABELS, formatWait } from "@/lib/recenzije/automation/types";
import { requireOrg } from "@/lib/recenzije/session";

export const metadata = { title: "Automatizacije" };

const TRIGGER_LABEL = { SERVICE_COMPLETED: "Završena usluga", CLIENT_CREATED: "Novi klijent", MANUAL: "Ručno" } as const;

export default async function AutomationsPage() {
  const ctx = await requireOrg();
  const list = await db
    .select({
      a: automations,
      active: sql<number>`(select count(*)::int from ${automationRuns} r where r.automation_id = "nr_automations"."id" and r.status in ('RUNNING','WAITING'))`,
      completed: sql<number>`(select count(*)::int from ${automationRuns} r where r.automation_id = "nr_automations"."id" and r.status = 'COMPLETED')`,
    })
    .from(automations)
    .where(eq(automations.organizationId, ctx.org.id))
    .orderBy(desc(automations.enabled), desc(automations.createdAt));

  return (
    <>
      <PageHeader kicker="Automatizacije" title="Automatizacije" description="Tijekovi koji rade sami: pitaj za recenziju, pričekaj, provjeri, podsjeti." />
      <Card className="overflow-hidden">
        <CardHeader title="Vaše automatizacije" description={`Uključeno: ${list.filter((l) => l.a.enabled).length} · ukupno: ${list.length}`} />
        {list.length === 0 ? (
          <EmptyState icon={Workflow} title="Još nema automatizacija" description="Krenite od predloška ispod." />
        ) : (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {list.map(({ a, active, completed }) => (
              <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <Link href={`/recenzije/automatizacije/${a.id}`} className="group min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium group-hover:underline">{a.name}</span>
                    <Badge>{TRIGGER_LABEL[a.trigger]}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {a.steps.map((s) => (s.type === "wait" ? `Čekaj ${formatWait(s.minutes)}` : STEP_LABELS[s.type])).join(" → ")}
                  </p>
                </Link>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-subtle">
                    {active} u tijeku · {completed} gotovo
                  </span>
                  <AutomationToggle id={a.id} enabled={a.enabled} name={a.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="label mb-3 mt-10 flex items-center gap-2"><span className="size-1.5 bg-orange" />Krenite od predloška</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {AUTOMATION_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.key}
            templateKey={t.key}
            name={t.name}
            description={t.description}
            steps={`Koraka: ${t.steps.length} · ${TRIGGER_LABEL[t.trigger]}`}
          />
        ))}
      </div>
    </>
  );
}
