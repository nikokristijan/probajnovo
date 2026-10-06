import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { selectDistinct } from "../shared";
import { CampaignControls } from "@/components/recenzije/app/campaigns/campaign-controls";
import { CampaignForm } from "@/components/recenzije/app/campaigns/campaign-form";
import { KpiCard } from "@/components/recenzije/app/kpi";
import { Badge, PageHeader } from "@/components/recenzije/ui/primitives";
import { db } from "@/lib/recenzije/db";
import { automationRuns, campaigns } from "@/lib/recenzije/db/schema";
import { env } from "@/lib/recenzije/env";
import { requireOrg } from "@/lib/recenzije/session";
import { formatDate } from "@/lib/recenzije/status";
import { byCampaign } from "@/lib/recenzije/services/stats";
import { CalendarClock, MousePointerClick, Send, Star } from "lucide-react";

export const metadata = { title: "Kampanja" };
const CAMPAIGN_LABEL = { DRAFT: "skica", ACTIVE: "aktivna", PAUSED: "pauzirana", COMPLETED: "završena" } as const;

const TONE = { DRAFT: "neutral", ACTIVE: "green", PAUSED: "amber", COMPLETED: "blue" } as const;

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const [c] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.organizationId, ctx.org.id))).limit(1);
  if (!c) notFound();
  const [services, stats, [{ n: waiting }]] = await Promise.all([
    selectDistinct(ctx.org.id),
    byCampaign(ctx.org.id),
    db.select({ n: count() }).from(automationRuns).where(and(eq(automationRuns.campaignId, c.id), eq(automationRuns.status, "WAITING"))),
  ]);
  const s = stats.find((x) => x.id === c.id);
  return (
    <>
      <Link href="/recenzije/kampanje" className="label mb-6 inline-flex items-center gap-1.5 text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Kampanje
      </Link>
      <PageHeader
        title={c.name}
        description={
          <span className="inline-flex items-center gap-2">
            <Badge tone={TONE[c.status]} dot>
              {CAMPAIGN_LABEL[c.status]}
            </Badge>
            {c.launchedAt ? `Pokrenuta ${formatDate(c.launchedAt)}` : "Još nije pokrenuta"}
          </span>
        }
        actions={<CampaignControls id={c.id} status={c.status} />}
      />
      {c.status !== "DRAFT" && (
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard label="Poslane poruke" value={s?.sent ?? 0} icon={Send} hint={`${s?.recipients ?? 0} primatelja`} />
          <KpiCard label="Kliknuli" value={s?.clicked ?? 0} icon={MousePointerClick} />
          <KpiCard label="Recenzije" value={s?.reviewed ?? 0} icon={Star} tone="green" hint={`${s?.conversion ?? 0}% konverzija`} />
          <KpiCard label="Zakazano" value={waiting} icon={CalendarClock} tone="amber" hint="Čeka slanje" />
        </div>
      )}
      <CampaignForm
        services={services}
        businessName={ctx.org.name}
        previewLink={`${env.appUrl}/r/Ab3xK9pQ2m`}
        locked={c.status !== "DRAFT"}
        initial={{
          id: c.id,
          status: c.status,
          name: c.name,
          trigger: c.trigger,
          serviceWithinDays: c.audience.serviceWithinDays,
          statuses: c.audience.statuses,
          service: c.audience.service ?? "",
          messageBody: c.messageBody,
          delayMinutes: c.delayMinutes,
          followUpEnabled: c.followUpEnabled,
          followUpAfterHours: c.followUpAfterHours,
          followUpBody: c.followUpBody ?? "",
        }}
      />
    </>
  );
}
