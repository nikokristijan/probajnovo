import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { deletePushSubscription } from "@/lib/db/queries";

/**
 * Briše pretplatu ovog uređaja (admin isključio obavijesti u postavkama —
 * vidi PushNotificationToggle.tsx). Poznavanje endpoint vrijednosti je samo
 * po sebi dovoljan dokaz da je zahtjev s tog uređaja, ali svejedno tražimo
 * prijavu radi dosljednosti s ostalim /api/admin rutama.
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdminRecord();
  if (!admin) {
    return NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "Neispravan zahtjev" }, { status: 400 });
  }

  await deletePushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
