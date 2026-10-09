import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { AutomationBuilder } from "@/components/recenzije/app/automations/builder";
import { hitArea, PageHeader } from "@/components/recenzije/ui/primitives";
import { db } from "@/lib/recenzije/db";
import { automationRuns, automations, clients } from "@/lib/recenzije/db/schema";
import { requireOrg } from "@/lib/recenzije/session";

export const metadata = { title: "Uređivač automatizacije" };

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const [a] = await db.select().from(automations).where(and(eq(automations.id, id), eq(automations.organizationId, ctx.org.id))).limit(1);
  if (!a) notFound();
  const [runs, clientRows] = await Promise.all([
    db.select({ status: automationRuns.status, n: count() }).from(automationRuns).where(eq(automationRuns.automationId, a.id)).groupBy(automationRuns.status),
    db.select({ id: clients.id, f: clients.firstName, l: clients.lastName }).from(clients).where(and(eq(clients.organizationId, ctx.org.id), eq(clients.smsOptOut, false))).orderBy(asc(clients.firstName)).limit(500),
  ]);
  const n = (s: string[]) => runs.filter((r) => s.includes(r.status)).reduce((x, r) => x + r.n, 0);
  return (
    <>
      <Link href="/recenzije/automatizacije" className={`${hitArea} label mb-6 inline-flex items-center gap-1.5 text-muted hover:text-foreground`}>
        <ArrowLeft className="size-4" /> Automatizacije
      </Link>
      <PageHeader kicker="Automatizacija" title={a.name} description="Složite tijek odozgo prema dolje. Izmjene vrijede za nova pokretanja nakon spremanja." />
      <AutomationBuilder
        automation={{ id: a.id, name: a.name, description: a.description, trigger: a.trigger, enabled: a.enabled, steps: a.steps }}
        clients={clientRows.map((c) => ({ id: c.id, name: `${c.f} ${c.l}`.trim() }))}
        stats={{ active: n(["RUNNING", "WAITING"]), completed: n(["COMPLETED"]), failed: n(["FAILED"]) }}
      />
    </>
  );
}
