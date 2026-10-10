import Link from "next/link";
import { ExternalLink, QrCode, UtensilsCrossed } from "lucide-react";
import { MenuWorkspace } from "@/components/recenzije/app/menu/menu-workspace";
import { parseMenuTab, toGuestView, type CategoryDTO } from "@/components/recenzije/app/menu/menu-types";
import { Button } from "@/components/recenzije/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";
import { getGuestSummary, listRecentGuests } from "@/lib/recenzije/services/guests";
import { getVenueMenuForOperator } from "@/lib/recenzije/services/menus";

export const metadata = { title: "Jelovnik" };

const GUEST_PAGE = 25;

type SP = Record<string, string | undefined>;

export default async function MenuPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  // Sve što se čita ili piše vezano je uz AKTIVNU tvrtku iz sesije; jelovnik postoji samo za ugostiteljstvo.
  const view = ctx.org.isVenue ? await getVenueMenuForOperator(ctx.org.id) : null;

  if (!view) {
    return (
      <>
        <PageHeader kicker="Jelovnik" title="Digitalni jelovnik" />
        <Card>
          <EmptyState
            icon={UtensilsCrossed}
            title="Jelovnik je za kafiće i restorane"
            description="Ova tvrtka nije označena kao ugostiteljstvo. Vrstu poslovanja mijenja NOVO tim u adminu, u uređivanju klijenta."
            action={
              <Button variant="secondary" asChild>
                <Link href="/recenzije/pregled">Natrag na pregled</Link>
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const [summary, guestRows] = await Promise.all([getGuestSummary(ctx.org.id), listRecentGuests(ctx.org.id, GUEST_PAGE + 1, 0)]);
  const now = new Date();

  const categories: CategoryDTO[] = view.categories.map((c) => ({
    id: c.id,
    name: c.name,
    nameEn: c.nameEn,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      nameEn: i.nameEn,
      description: i.description,
      descriptionEn: i.descriptionEn,
      priceCents: i.priceCents,
      allergens: i.allergens,
      available: i.available,
    })),
  }));

  const m = view.menu;
  let host = "";
  try {
    host = new URL(view.publicUrl).host;
  } catch {
    host = view.publicUrl.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  }

  return (
    <>
      <PageHeader
        kicker="Jelovnik"
        title="Digitalni jelovnik"
        description="Gost skenira QR kod, upiše broj mobitela i otvara jelovnik. Broj se sprema, a nakon sat i pol do dva sata gostu stiže poruka s molbom za Google recenziju."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/recenzije/plakat?nacin=jelovnik">
                <QrCode /> QR kodovi
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <a href={view.publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Otvori jelovnik
              </a>
            </Button>
          </>
        }
      />
      <MenuWorkspace
        readOnly={ctx.org.isDemo}
        publicUrl={view.publicUrl}
        host={host}
        settings={{
          slug: m.slug,
          enabled: m.enabled,
          title: m.title,
          intro: m.intro,
          introEn: m.introEn,
          externalUrl: m.externalUrl,
          allowSkip: m.allowSkip,
          delayMinutes: m.delayMinutes,
        }}
        categories={categories}
        hasReviewUrl={Boolean(ctx.org.googleReviewUrl?.trim())}
        summary={summary}
        guests={guestRows.slice(0, GUEST_PAGE).map((r) => toGuestView(r, ctx.org.timezone, now))}
        guestsHasMore={guestRows.length > GUEST_PAGE}
        initialTab={parseMenuTab(sp.tab)}
      />
    </>
  );
}
