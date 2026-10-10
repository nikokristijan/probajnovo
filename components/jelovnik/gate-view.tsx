import Link from "next/link";
import type { GateResult } from "@/app/jelovnik/[slug]/actions";
import { guestGateExplanation } from "@/lib/recenzije/guest-consent";
import type { PublicMenuInfo } from "@/lib/recenzije/services/menus";
import { Footer, Kicker } from "./chrome";
import { GateForm } from "./gate-form";

/**
 * Vrata: naziv lokala, kratko objašnjenje, broj mobitela i privola. Ako lokal dopušta pregled bez broja, ispod obrasca
 * je jasna sporedna poveznica koja otvara jelovnik bez ikakvog spremanja.
 */
export function GateView({
  menu,
  consentText,
  table,
  skipHref,
  initialNotice,
}: {
  menu: PublicMenuInfo;
  consentText: string;
  table: string | null;
  /** Adresa za pregled bez broja; null kad lokal to ne dopušta. */
  skipHref: string | null;
  /** Greška iz ?greska= (obrazac poslan bez JavaScripta); inače null. */
  initialNotice: GateResult | null;
}) {
  return (
    <>
      <main className="jl-main">
        <div className="jl-wrap jl-gate">
          <Kicker>{menu.title}</Kicker>
          <h1 className="jl-title">{menu.venueName}</h1>
          <p className="jl-lead">{guestGateExplanation(menu.venueName)}</p>

          <GateForm slug={menu.slug} table={table} consentText={consentText} initial={initialNotice} />

          {skipHref && (
            <div className="jl-skip">
              <Link href={skipHref} prefetch={false} className="jl-btn jl-btn-2">
                Pogledaj jelovnik bez unosa broja
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
