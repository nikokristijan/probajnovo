import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listDirectMessages, markDirectMessagesRead } from "@/lib/db/queries";

/**
 * Portal — 1:1 razgovor (?with=<email drugog sugovornika>), pollano s
 * klijenta (components/admin/DirectMessageThread.tsx) svakih ~4s (isti
 * "brzi polling" izbor kao opći tim kanal, vidi ../messages/route.ts).
 * Svaki poziv ujedno označava primljene poruke pročitanima (viewer je
 * upravo gleda nit) — jeftina idempotentna nuzradnja, isto ponašanje kao
 * otvaranje niti (markDirectMessagesReadAction), samo osvježeno na svaki
 * "otkucaj" dok je nit otvorena.
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdminRecord();
  if (!admin || admin.role === "owner") {
    return NextResponse.json({ error: "Nemate pristup" }, { status: 403 });
  }

  const otherEmail = new URL(request.url).searchParams.get("with")?.trim();
  if (!otherEmail) {
    return NextResponse.json({ error: "Nedostaje sugovornik" }, { status: 400 });
  }

  await markDirectMessagesRead(admin.email, otherEmail);
  const messages = await listDirectMessages(admin.email, otherEmail);
  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      fromEmail: m.fromEmail,
      toEmail: m.toEmail,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
