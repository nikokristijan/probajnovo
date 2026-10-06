import { after, NextResponse, type NextRequest } from "next/server";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { processDueRuns } from "@/lib/recenzije/services/automation-engine";
import { recordClick } from "@/lib/recenzije/services/tracking";

export const dynamic = "force-dynamic";

/**
 * Javni praćeni link iz SMS-a (NOVO Recenzije): zabilježi klik, pa preusmjeri
 * na Google stranicu za recenziju. Kratko i bez kolačića.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9]{6,32}$/.test(token)) return new NextResponse("Link nije pronađen", { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`r:${ip}`, 60, 60_000);
  if (!rl.ok) return new NextResponse("Previše zahtjeva", { status: 429 });
  await ensureReviewsDb();
  const dest = await recordClick(token, { userAgent: req.headers.get("user-agent"), ip });
  if (!dest) return new NextResponse("Ovaj link za recenziju više ne vrijedi.", { status: 404 });
  after(() => processDueRuns(10).catch(() => undefined));
  const res = NextResponse.redirect(dest, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
