import { NextRequest, NextResponse } from "next/server";

/**
 * Wildcard poddomene za vikendice: "<slug>.<APEX_HOST>" se iznutra prikazuje
 * kao "/<slug>" (ista stranica kao <APEX_HOST>/<slug>) — adresna traka gostu
 * ostaje na njegovoj poddomeni, nema preusmjeravanja/redirecta.
 *
 * VAŽNO: "novo.hr" NIJE prava domena ovog projekta — to je već tuđa,
 * postojeća stranica (hrvatski portal s vijestima), nepovezana s ovime.
 * Prava domena je probajnovo.com (stranica je do sad bila live na
 * probajnovo.vercel.app). APEX_HOST se čita iz env varijable — dok se ne
 * postavi, ovaj middleware ništa ne radi (nijedan hostname se neće
 * poklopiti), pa je siguran no-op dok se domena stvarno ne poveže.
 *
 * Jednokratno postavljanje (izvan ovog koda, radi se ručno jednom):
 *   1. Postaviti NEXT_PUBLIC_APEX_HOST=probajnovo.com (Vercel → Project →
 *      Settings → Environment Variables) i redeployati.
 *   2. Vercel → Project → Settings → Domains → dodati "*.probajnovo.com"
 *      (i "probajnovo.com" ako apex domena još nije dodana).
 *   3. Kod DNS registratora za probajnovo.com dodati: CNAME  *  →  cname.vercel-dns.com
 * Nakon toga svaka nova vikendica automatski dobiva svoju poddomenu čim joj
 * admin postavi slug — nema dodatnog koraka po vikendici.
 *
 * Prave vlastite domene (npr. "vila-marija.com") su sljedeći korak — polje
 * `customDomain` u adminu trenutno samo bilježi namjeru vlasnika; usmjeravanje
 * prometa s takve domene na pravu vikendicu dodaje se kad prva stvarno zatreba.
 */
const APEX_HOST = process.env.NEXT_PUBLIC_APEX_HOST ?? "";
const IGNORED_SUBDOMAINS = new Set(["www", "admin", "api"]);

export function middleware(req: NextRequest) {
  if (!APEX_HOST) return NextResponse.next();

  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();

  if (!hostname.endsWith(`.${APEX_HOST}`)) return NextResponse.next();

  const subdomain = hostname.slice(0, -(`.${APEX_HOST}`.length));
  if (!subdomain || subdomain.includes(".") || IGNORED_SUBDOMAINS.has(subdomain)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
