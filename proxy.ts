import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "novo_admin_session";

// Ova ruta unutar /admin ne smije tražiti prijavu (inače nitko ne bi mogao
// doći do login forme).
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login"]);

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

/**
 * Wildcard poddomene za vikendice i firme: "<slug>.<APEX_HOST>" se iznutra
 * prikazuje kao "/<slug>" (ista stranica kao <APEX_HOST>/<slug>) — adresna
 * traka gostu ostaje na njegovoj poddomeni, nema preusmjeravanja/redirecta.
 *
 * VAŽNO: "novo.hr" NIJE prava domena ovog projekta — to je već tuđa,
 * postojeća stranica (hrvatski portal s vijestima), nepovezana s ovime.
 * Prava domena je probajnovo.com (stranica je do sad bila live na
 * probajnovo.vercel.app). APEX_HOST se čita iz env varijable — dok se ne
 * postavi, ovaj dio ništa ne radi (nijedan hostname se neće poklopiti), pa
 * je siguran no-op dok se domena stvarno ne poveže.
 *
 * Jednokratno postavljanje (izvan ovog koda, radi se ručno jednom):
 *   1. Postaviti NEXT_PUBLIC_APEX_HOST=probajnovo.com (Vercel → Project →
 *      Settings → Environment Variables) i redeployati.
 *   2. Vercel → Project → Settings → Domains → dodati "*.probajnovo.com"
 *      (i "probajnovo.com" ako apex domena još nije dodana).
 *   3. Kod DNS registratora za probajnovo.com dodati: CNAME  *  →  cname.vercel-dns.com
 * Nakon toga svaka nova vikendica/firma automatski dobiva svoju poddomenu
 * čim joj admin postavi slug — nema dodatnog koraka po unosu.
 *
 * Prave vlastite domene (npr. "vila-marija.com") su sljedeći korak — polje
 * `customDomain` u adminu trenutno samo bilježi namjeru vlasnika; usmjeravanje
 * prometa s takve domene na pravi unos dodaje se kad prva stvarno zatreba.
 */
const APEX_HOST = process.env.NEXT_PUBLIC_APEX_HOST ?? "";
const IGNORED_SUBDOMAINS = new Set(["www", "admin", "api"]);

function rewriteWildcardSubdomain(req: NextRequest): NextResponse | null {
  if (!APEX_HOST) return null;

  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname.endsWith(`.${APEX_HOST}`)) return null;

  const subdomain = hostname.slice(0, -(`.${APEX_HOST}`.length));
  if (!subdomain || subdomain.includes(".") || IGNORED_SUBDOMAINS.has(subdomain)) {
    return null;
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

// Next.js 16 dopušta SAMO JEDAN proxy/middleware fajl u projektu — ovdje
// spajamo dvije neovisne provjere (poddomena → rewrite, /admin → auth) u
// jednu funkciju umjesto dva odvojena fajla (middleware.ts + proxy.ts), jer
// build inače puca s "Both middleware file and proxy file are detected".
export async function proxy(req: NextRequest) {
  const rewritten = rewriteWildcardSubdomain(req);
  if (rewritten) return rewritten;

  // Optimistic check (čita samo kolačić) — svaka server akcija radi i svoju
  // pravu provjeru sesije prije bilo kakve izmjene baze. Vidi lib/auth.ts.
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin") || PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const authed = await hasValidSession(req);
  if (authed) return NextResponse.next();

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
