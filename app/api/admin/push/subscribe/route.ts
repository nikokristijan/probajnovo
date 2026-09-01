import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { savePushSubscription } from "@/lib/db/queries";

/**
 * Prima PushSubscription objekt s klijenta (nakon
 * pushManager.subscribe(), vidi PushNotificationToggle.tsx) i sprema ga
 * (upsert po endpoint) za trenutno prijavljenog admina — vidi
 * lib/push.ts sendPushToAdmins koji ovo kasnije čita.
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdminRecord();
  if (!admin) {
    return NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Neispravna pretplata" }, { status: 400 });
  }

  await savePushSubscription({ adminId: admin.id, endpoint, p256dh, auth });
  return NextResponse.json({ ok: true });
}
