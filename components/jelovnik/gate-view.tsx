import Link from "next/link";
import type { GateResult } from "@/app/jelovnik/[slug]/actions";
import { guestConsentDetails, guestConsentSummary, guestGateLine } from "@/lib/recenzije/guest-consent";
import { menuNoun } from "@/lib/recenzije/menu-noun";
import type { PublicCategory, PublicMenuInfo } from "@/lib/recenzije/services/menus";
import { Brand } from "./brand";
import { Footer } from "./chrome";
import { GateBackdrop } from "./gate-backdrop";
import { GateForm } from "./gate-form";

/**
 * Vrata: mali prozor na sredini ekrana iznad zamućene, zatamnjene stranice. U prozoru su logo ili naziv lokala, jedna kratka
 * rečenica, broj mobitela, jedna privola (kratka rečenica + "Pročitaj više") i zlatni gumb; ispod njega sitna, čitljiva
 * poveznica za pregled bez broja (ako je lokal dopušta), koja ništa ne sprema. Sve je poslužiteljski ispisano i radi bez
 * JavaScripta (obrazac se šalje izvorno). Pozadina je ukrasna i neaktivna; stranica iza se ne može pomicati.
 */
export function GateView({
  menu,
  table,
  skipHref,
  initialNotice,
  backdropCategories,
}: {
  menu: PublicMenuInfo;
  table: string | null;
  /** Adresa za pregled bez broja; null kad lokal to ne dopušta. */
  skipHref: string | null;
  /** Greška iz ?greska= (obrazac poslan bez JavaScripta); inače null. */
  initialNotice: GateResult | null;
  /** Stvarne kategorije za pozadinu (samo kad lokal dopušta pregled bez broja); inače null = neutralan kostur. */
  backdropCategories: PublicCategory[] | null;
}) {
  const noun = menuNoun(menu.menuKind);
  return (
    <div className="jl-gate-layer">
      <GateBackdrop menu={menu} categories={menu.allowSkip ? backdropCategories : null} />
      <div className="jl-scrim" aria-hidden="true" />
      <main className="jl-gate-main">
        <section className="jl-card" role="dialog" aria-modal="false" aria-labelledby="jl-gate-title">
          <Brand id="jl-gate-title" name={menu.venueName} logoUrl={menu.logoUrl} />
          <p className="jl-card-line">{guestGateLine(menu.menuKind)}</p>

          <GateForm
            slug={menu.slug}
            table={table}
            menuKind={menu.menuKind}
            noticesEnabled={menu.noticesEnabled}
            consentSummary={guestConsentSummary(menu.venueName, menu.delayMinutes, menu)}
            consentDetails={guestConsentDetails(menu.delayMinutes, menu)}
            initial={initialNotice}
          />

          {skipHref && (
            <p className="jl-skip">
              <Link href={skipHref} prefetch={false} className="jl-skip-link">
                Pogledaj {noun.acc} bez unosa broja
              </Link>
            </p>
          )}
        </section>
      </main>
      <Footer kind={menu.menuKind} />
    </div>
  );
}
