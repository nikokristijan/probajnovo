import { NextRequest, NextResponse } from "next/server";

/**
 * Wildcard poddomene za vikendice: "<slug>.novo.hr" se iznutra prikazuje
 * kao "/<slug>" (ista stranica kao novo.hr/<slug>) — adresna traka gostu
 * ostaje na njegovoj poddomeni, nema preusmjeravanja/redirecta.
 *
 * Jednokratno postavljanje (izvan ovog koda, radi se ručno jednom za sav sustav):
 *   1. Vercel → Project → Settings → Domains → dodaj "*.novo.hr"
 *   2. Kod DNS registratora za novo.hr dodaj: CNAME  *  →  cname.vercel-dns.com
 * Nakon toga svaka nova vikendica automatski dobiva svoju poddomenu čim joj
 * admin postavi slug — nema dodatnog koraka po vikendici.
 *
 * Prave vlastite domene (npr. "vila-marija.com") su sljedeći korak — polje
 * `customDomain` u adminu trenutno samo bilježi namjeru vlasnika; usmjeravanje
 * prometa s takve domene na pravu vikendicu dodaje se kad prva stvarno zatreba.
 */
const APEX_HOST = "novo.hr";
const IGNORED_SUBDOMAINS = new Set(["www", "admin", "api"]);

export function middleware(req: NextRequest) {
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
