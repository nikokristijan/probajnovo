import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listTeamMembers } from "@/lib/db/queries";

/**
 * "Ured" prisutnost (app/admin/poruke, components/admin/OfficePresence.tsx)
 * — vraća samo email + lastSeenAt po članu tima, pollano s klijenta svakih
 * ~20s da se pikselizirani ured osvježava bez pune navigacije/reloada
 * stranice (poruke feed ostaje jednostavan/bez pollinga, ovo je odvojeno).
 * Zaštićeno kao i ostatak /admin — puni admin/superadmin, nikad vlasnik
 * (vlasnici nisu dio "Ureda", vidi listTeamMembers).
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
    })),
  });
}
