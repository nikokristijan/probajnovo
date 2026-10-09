import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/recenzije/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";
import { byCampaign } from "@/lib/recenzije/services/stats";

export const metadata = { title: "Kampanje" };

const CAMPAIGN_LABEL = { DRAFT: "skica", ACTIVE: "aktivna", PAUSED: "pauzirana", COMPLETED: "završena" } as const;

const CAMPAIGN_TONE = { DRAFT: "neutral", ACTIVE: "green", PAUSED: "amber", COMPLETED: "blue" } as const;

export default async function CampaignsPage() {
  const ctx = await requireOrg();
  const list = await byCampaign(ctx.org.id);
  const newBtn = (
    <Button asChild>
      <Link href="/recenzije/kampanje/nova">
        <Plus /> Nova kampanja
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader kicker="Kampanje" title="Kampanje" description="Pošaljite zahtjev za recenziju skupini starijih klijenata, uz automatski podsjetnik." actions={newBtn} />
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="Napravite prvu kampanju"
            description="Javite se svima kojima ste radili prošli mjesec, a još ih niste pitali za recenziju."
            action={newBtn}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((c) => (
            <Link key={c.id} href={`/recenzije/kampanje/${c.id}`} className="group @container border border-border bg-white p-5 transition-colors hover:border-foreground">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold group-hover:underline">{c.name}</h2>
                <Badge tone={CAMPAIGN_TONE[c.status]} dot>
                  {CAMPAIGN_LABEL[c.status]}
                </Badge>
              </div>
              {/* Četiri pločice stanu tek kad kartica ima ~320px sadržaja; ispod toga 2x2 da natpisi ne iscure iz okvira. */}
              <dl className="mt-5 grid grid-cols-2 gap-2 text-center @[20rem]:grid-cols-4">
                {[
                  ["Poslano", c.sent],
                  ["Klikovi", c.clicked],
                  ["Recenzije", c.reviewed],
                  ["Neuspjelo", c.failed],
                ].map(([k, val]) => (
                  <div key={k as string} className="min-w-0 border border-border px-1.5 py-2.5">
                    <dd className="tabular text-lg font-semibold">{val}</dd>
                    <dt className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{k}</dt>
                  </div>
                ))}
              </dl>
              <div className="mt-4">
                <div className="label flex justify-between text-muted">
                  <span>Konverzija</span>
                  <span className="tabular">{c.conversion}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden bg-surface-2">
                  <div className="h-full bg-orange" style={{ width: `${Math.min(100, c.conversion)}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
