import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { selectDistinct } from "../shared";
import { CampaignForm } from "@/components/recenzije/app/campaigns/campaign-form";
import { hitArea, PageHeader } from "@/components/recenzije/ui/primitives";
import { DEFAULT_FOLLOW_UP, DEFAULT_REQUEST } from "@/lib/recenzije/automation/templates";
import { env } from "@/lib/recenzije/env";
import { requireOrg } from "@/lib/recenzije/session";

export const metadata = { title: "Nova kampanja" };

export default async function NewCampaignPage() {
  const ctx = await requireOrg();
  const services = await selectDistinct(ctx.org.id);
  return (
    <>
      <Link href="/recenzije/kampanje" className={`${hitArea} label mb-6 inline-flex items-center gap-1.5 text-muted hover:text-foreground`}>
        <ArrowLeft className="size-4" /> Kampanje
      </Link>
      <PageHeader kicker="Kampanje" title="Nova kampanja" />
      <CampaignForm
        services={services}
        businessName={ctx.org.name}
        previewLink={`${env.appUrl}/r/Ab3xK9pQ2m`}
        initial={{
          name: "",
          trigger: "LAUNCH",
          serviceWithinDays: 30,
          statuses: ["NOT_CONTACTED"],
          service: "",
          messageBody: DEFAULT_REQUEST,
          delayMinutes: 0,
          followUpEnabled: true,
          followUpAfterHours: 48,
          followUpBody: DEFAULT_FOLLOW_UP,
        }}
      />
    </>
  );
}
