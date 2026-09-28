import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listTeamMessages } from "@/lib/db/queries";

/**
 * Portal — opći tim kanal (Teams/Slack-stil niti u app/admin/portal),
 * pollano s klijenta (components/admin/TeamChannelThread.tsx) svakih ~4s
 * na izričit korisnikov zahtjev "brzi polling" (umjesto pravog websocketa)
 * da ostali članovi tima vide nove poruke bez ručnog osvježavanja stranice.
 * Zaštićeno kao i ostatak Portala — puni admin/superadmin, nikad vlasnik.
 */
export async function GET() {
  const admin = await getCurrentAdminRecord();
  if (!admin || admin.role === "owner") {
    return NextResponse.json({ error: "Nemate pristup" }, { status: 403 });
  }

  const messages = await listTeamMessages(200);
  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      adminEmail: m.adminEmail,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
