import { after, NextResponse, type NextRequest } from "next/server";
import { getNfcLinkTarget, recordNfcLinkScan } from "@/lib/db/links";
import { NFC_LINK_CODE_RE } from "@/lib/linkHost";

export const dynamic = "force-dynamic";

/**
 * Dinamički NFC link: <LINK_HOST>/<code> (ili probajnovo.com/k/<code>) →
 * trenutno odredište iz admina (/admin/linkovi). Čisti HTTP 302 bez ikakve
 * stranice — telefon odmah otvara odredište, nigdje se ne prikazuje naš
 * naziv. 302 + no-store namjerno (ne 301): 301 preglednik trajno pamti pa
 * kasnija promjena odredišta ne bi stigla do onih koji su već skenirali.
 * Brojač se upisuje tek nakon slanja odgovora (after), da ne usporava.
 */
function notFound() {
  // Neutralno: bez naslova, brendinga i HTML-a.
  return new NextResponse("404", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

async function handle(req: NextRequest, code: string) {
  const c = code.toLowerCase();
  if (!NFC_LINK_CODE_RE.test(c)) return notFound();
  const link = await getNfcLinkTarget(c);
  if (!link || !link.active) return notFound();
  if (req.method === "GET") after(() => recordNfcLinkScan(link.id).catch(() => undefined));
  const res = NextResponse.redirect(link.targetUrl, 302);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(req, (await params).code);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(req, (await params).code);
}
