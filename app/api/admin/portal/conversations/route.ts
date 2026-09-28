import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listDmConversations } from "@/lib/db/queries";

/**
 * Portal sidebar — popis DM razgovora (zadnja poruka + broj nepročitanih po
 * sugovorniku), pollano sporije (~8s, vidi PortalSidebar.tsx) od same
 * otvorene niti — sidebar samo treba znati "ima nešto novo", ne prikazuje
 * svaku poruku uživo kao otvorena nit.
 */
export async function GET() {
  const admin = await getCurrentAdminRecord();
  if (!admin || admin.role === "owner") {
    return NextResponse.json({ error: "Nemate pristup" }, { status: 403 });
  }

  const conversations = await listDmConversations(admin.email);
  return NextResponse.json({
    conversations: conversations.map((c) => ({
      email: c.email,
      lastBody: c.lastBody,
      lastAt: c.lastAt.toISOString(),
      unreadCount: c.unreadCount,
    })),
  });
}
