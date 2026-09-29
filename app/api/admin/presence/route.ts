import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listTeamMembers } from "@/lib/db/queries";

/**
 * "Ured" prisutnost (app/admin/poruke, components/admin/OfficePresence.tsx)
 * — vraća email/lastSeenAt/displayName/status po članu tima, pollano s
 * klijenta svakih ~20s da se pikselizirani ured osvježava bez pune
 * navigacije/reloada stranice (poruke feed ostaje jednostavan/bez pollinga,
 * ovo je odvojeno). displayName/statusText/statusEmoji su OVDJE (ne samo u
 * initialMembers s poslužitelja) da se ime i status ne izgube kolegama koji
 * gledaju ured nakon prvog pollinga (v8 popravak — dosad je poll vraćao
 * samo email/isSuperAdmin/lastSeenAt, pa bi se prikaz imena tiho vratio na
 * email prefiks čim stigne prvi poll). Zaštićeno kao i ostatak /admin — puni
 * admin/superadmin, nikad vlasnik (vlasnici nisu dio "Ureda", vidi
 * listTeamMembers).
 */
export async function GET() {
  const admin = await getCurrentAdminRecord();
  if (!admin || admin.role === "owner") {
    return NextResponse.json({ error: "Nemate pristup" }, { status: 403 });
  }

  const members = await listTeamMembers();
  return NextResponse.json({
    members: members.map((m) => ({
      email: m.email,
      isSuperAdmin: m.isSuperAdmin,
      lastSeenAt: m.lastSeenAt ? m.lastSeenAt.toISOString() : null,
      displayName: m.displayName,
      statusText: m.statusText,
      statusEmoji: m.statusEmoji,
    })),
  });
}
