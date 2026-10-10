import { after } from "next/server";
import Link from "next/link";
import { FlaskConical, UserCog } from "lucide-react";
import { MobileNav, Sidebar } from "@/components/recenzije/app/sidebar";
import { UserMenu } from "@/components/recenzije/app/user-menu";
import { hitArea } from "@/components/recenzije/ui/primitives";
import { OPERATOR_EMAIL } from "@/lib/recenzije/operator";
import { describePlan } from "@/lib/recenzije/plan-view";
import { requireOrg } from "@/lib/recenzije/session";
import { processDueRuns } from "@/lib/recenzije/services/automation-engine";
import { usage } from "@/lib/recenzije/services/billing";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const u = await usage(ctx.org.id);
  // Automatizacije napreduju i bez crona: nakon svakog prikaza stranice obradi što je dospjelo.
  after(() => processDueRuns(25).catch((e) => console.error("[recenzije] processDueRuns", e)));

  // NOVO tim radi u ime klijenta pod internim operaterom; ostali korisnici nikad ne vide traku.
  const isOperator = ctx.user.email === OPERATOR_EMAIL;
  const plan = describePlan(u, ctx.org.isDemo);

  return (
    <div className="min-h-dvh">
      <Sidebar orgName={ctx.org.name} plan={plan.chip} showAccount={!isOperator && !ctx.org.isDemo} isVenue={ctx.org.isVenue} />
      <div className="lg:pl-60">
        {isOperator && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-foreground px-4 py-2 text-center text-[13px] text-white">
            <span className="flex min-w-0 items-center gap-2">
              <UserCog className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">
                Radite kao NOVO tim za <b>{ctx.org.name}</b>
              </span>
            </span>
            <Link href="/admin/recenzije" className={`${hitArea} inline-block font-bold underline underline-offset-2`}>
              Natrag na admin
            </Link>
          </div>
        )}
        {ctx.org.isDemo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent px-4 py-2 text-center text-[13px] text-white">
            <FlaskConical className="size-4 shrink-0" aria-hidden />
            <span>Ovo je primjer za razgledavanje. Izmjene i slanje SMS-a su isključeni.</span>
            <Link href="/recenzije#upit" className={`${hitArea} inline-block font-bold underline underline-offset-2`}>
              Pošaljite upit
            </Link>
          </div>
        )}
        {!ctx.org.isDemo && !u.active && (
          <div className="bg-orange px-4 py-2 text-center text-[13px] text-black">
            Paket nije aktivan, pa je slanje poruka pauzirano.{" "}
            {isOperator ? (
              <Link href="/admin/recenzije" className={`${hitArea} inline-block font-bold underline underline-offset-2`}>
                Uredite u adminu
              </Link>
            ) : (
              <span className="font-bold">Javite se NOVO-u.</span>
            )}
          </div>
        )}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur sm:px-6">
          <MobileNav orgName={ctx.org.name} plan={plan.chip} showAccount={!isOperator && !ctx.org.isDemo} isVenue={ctx.org.isVenue} />
          <p className="min-w-0 truncate text-sm font-bold lg:hidden">{ctx.org.name}</p>
          <div className="ml-auto">
            <UserMenu
              name={ctx.user.name ?? ""}
              email={ctx.user.email}
              orgs={isOperator ? [] : ctx.memberships}
              activeOrgId={ctx.org.id}
              isOperator={isOperator}
              showAccount={!isOperator && !ctx.org.isDemo}
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
