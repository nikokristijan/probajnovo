import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listTeamMessagesWithReactions } from "@/lib/db/queries";

/**
 * Portal — opći tim kanal (Teams/Slack-stil niti u app/admin/portal),
 * pollano s klijenta (components/admin/TeamChannelThread.tsx) svakih ~4s
 * na izričit korisnikov zahtjev "brzi polling" (umjesto pravog websocketa)
 * da ostali članovi tima vide nove poruke bez ručnog osvježavanja stranice.
 * Zaštićeno kao i ostatak Portala — puni admin/superadmin, nikad vlasnik.
 * Uz tekst poruke vraća i emoji reakcije (grupirano, "mine" prema pozivatelju
 * — Portal Faza 5) i prikvačivanje (pinnedAt/pinnedByEmail), isti oblik kao
 * initialMessages u app/admin/portal/page.tsx da TeamChannelThread ne mora
 * razlikovati prvi render od pollinga.
 */
export async function GET() {
  const admin = await getCurrentAdminRecord();
  if (!admin || admin.role === "owner") {
    return NextResponse.json({ error: "Nemate pristup" }, { status: 403 });
  }

  const messages = await listTeamMessagesWithReactions(admin.email, 200);
  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      adminEmail: m.adminEmail,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      pinnedAt: m.pinnedAt ? m.pinnedAt.toISOString() : null,
      pinnedByEmail: m.pinnedByEmail,
      reactions: m.reactions,
    })),
  });
}
