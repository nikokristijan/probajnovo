import { after } from "next/server";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { MobileNav, Sidebar } from "@/components/recenzije/app/sidebar";
import { UserMenu } from "@/components/recenzije/app/user-menu";
import { requireOrg } from "@/lib/recenzije/session";
import { processDueRuns } from "@/lib/recenzije/services/automation-engine";
import { usage } from "@/lib/recenzije/services/billing";

function daysUntil(d: Date) {
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const u = await usage(ctx.org.id);
  // Automatizacije napreduju i bez crona: nakon svakog prikaza stranice obradi što je dospjelo.
  after(() => processDueRuns(25).catch((e) => console.error("[recenzije] processDueRuns", e)));

  const daysLeft = u.subscription?.trialEndsAt ? daysUntil(u.subscription.trialEndsAt) : null;
  const planLabel = ctx.org.isDemo
    ? "Demo"
    : u.plan
      ? `Paket ${u.plan.name}`
      : u.trialExpired
        ? "Proba je istekla"
        : `Besplatna proba${daysLeft != null ? ` · još ${daysLeft} d` : ""}`;

  return (
    <div className="min-h-dvh">
      <Sidebar orgName={ctx.org.name} plan={planLabel} />
      <div className="lg:pl-60">
        {ctx.org.isDemo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent px-4 py-2 text-center text-[13px] text-white">
            <FlaskConical className="size-4" />
            <span>Demo s primjerima podataka. Izmjene i slanje SMS-a su isključeni.</span>
            <Link href="/recenzije/registracija" className="font-bold underline underline-offset-2">
              Otvori svoj račun besplatno
            </Link>
          </div>
        )}
        {!ctx.org.isDemo && u.trialExpired && !u.plan && (
          <div className="bg-orange px-4 py-2 text-center text-[13px] text-black">
            Besplatna proba je istekla, pa je slanje poruka pauzirano.{" "}
            <Link href="/recenzije/postavke/pretplata" className="font-bold underline underline-offset-2">
              Odaberite paket
            </Link>
          </div>
        )}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur sm:px-6">
          <MobileNav orgName={ctx.org.name} plan={planLabel} />
          <p className="truncate text-sm font-bold lg:hidden">{ctx.org.name}</p>
          <div className="ml-auto">
            <UserMenu name={ctx.user.name ?? ""} email={ctx.user.email} orgs={ctx.memberships} activeOrgId={ctx.org.id} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
