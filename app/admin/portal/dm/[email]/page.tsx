import { notFound } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import { listDirectMessages, markDirectMessagesRead, listTeamMembers } from "@/lib/db/queries";
import DirectMessageThread from "@/components/admin/DirectMessageThread";

/**
 * 1:1 razgovor (Portal Faza 3, "Nek bude i direktno dopisivanje") — otvara
 * se preko PortalSidebar.tsx linka. Označava primljene poruke pročitanima
 * čim se stranica otvori (markDirectMessagesRead), isto ponašanje kao
 * app/api/admin/portal/dm koji to ponavlja na svaki poll dok je nit
 * otvorena. otherEmail mora biti postojeći član tima (ne vlasnik) —
 * inače notFound(), da admin ne može poslati "u prazno" nepostojećem emailu.
 */
export default async function DirectMessagePage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const otherEmail = decodeURIComponent(email);
  const admin = await requireFullAdmin();

  const teamMembers = await listTeamMembers();
  const roster = teamMembers.map((m) => ({ email: m.email, displayName: m.displayName ?? null }));
  const isValidMember = roster.some((m) => m.email === otherEmail);
  if (!isValidMember || otherEmail === admin.email) notFound();

  await markDirectMessagesRead(admin.email, otherEmail);
  const messages = await listDirectMessages(admin.email, otherEmail);

  return (
    <DirectMessageThread
      currentEmail={admin.email}
      otherEmail={otherEmail}
      roster={roster}
      initialMessages={messages.map((m) => ({
        id: m.id,
        fromEmail: m.fromEmail,
        toEmail: m.toEmail,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
