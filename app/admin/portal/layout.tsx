import { requireFullAdmin } from "@/lib/auth";
import { listTeamMembers, listDmConversations, getWeeklyLeaderboard } from "@/lib/db/queries";
import OfficePresence from "@/components/admin/OfficePresence";
import PortalTopBar from "@/components/admin/PortalTopBar";
import { PortalIcon } from "@/components/admin/Icons";

/**
 * Portal — dijeljena ljuska za /admin/portal (jedinstveni pregled),
 * /admin/portal/dm/[email] i /admin/portal/profil/[email]: "Ured"
 * prisutnost na vrhu (puna širina, vidi OfficePresence.tsx v3 — NAMJERNO
 * NETAKNUT ovim redizajnom) + tanka PortalTopBar (poveznica natrag na
 * pregled + vodoravni niz DM kontakata + moj profil).
 *
 * NOVO/Revolut redizajn ("PORTAL nema sa strane tim/zadaci/statistika
 * nego da to sve bude na jednoj stranici") — raniji bočni izbornik
 * (PortalSidebar, .portal-shell dvostupčani grid) je UKLONJEN: Tim/Zadaci/
 * Statistika/Rođendani/Aktivnost/Pretraga su sad sve dijelovi JEDNE
 * scrollajuće stranice (app/admin/portal/page.tsx → PortalOverview.tsx),
 * ne odvojeni tabovi iza ?tab=. DM razgovori i dalje žive na svojoj ruti
 * (dm/[email]) jer su stvarno zaseban kontekst (1:1 nit), ali se do njih
 * dolazi preko vodoravnog niza u PortalTopBar-u, dostupnog na SVAKOJ
 * portal ruti (ne samo s početne), tako da se prebacivanje između
 * razgovora ne izgubi. Cijeli omotač koristi .admin-breakout da se
 * rasporedi preko cijelog ekrana, izlazeći iz dijeljenog max-w-4xl <main>
 * u app/admin/layout.tsx bez da se taj wrapper mijenja za ostalih 27
 * admin stranica. requireFullAdmin već isključuje vlasnike.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireFullAdmin();

  const [teamMembers, conversations, leaderboard] = await Promise.all([
    listTeamMembers(),
    listDmConversations(admin.email),
    getWeeklyLeaderboard(),
  ]);

  const roster = teamMembers.map((m) => ({ email: m.email, displayName: m.displayName ?? null }));
  const officeMembers = teamMembers.map((m) => ({
    email: m.email,
    isSuperAdmin: m.isSuperAdmin,
    lastSeenAt: m.lastSeenAt ? m.lastSeenAt.toISOString() : null,
    displayName: m.displayName,
    statusText: m.statusText,
    statusEmoji: m.statusEmoji,
  }));

  return (
    <div className="admin-breakout">
      <div className="admin-breakout-inner flex flex-col gap-5">
        <div>
          <h1 className="na-heading text-xl flex items-center gap-2">
            <PortalIcon className="text-[#ff7f00]" />
            Portal
          </h1>
          <p className="na-kicker mt-1">Tim, zadaci, poruke i statistika agencije — jedan pregled</p>
        </div>

        <OfficePresence initialMembers={officeMembers} currentEmail={admin.email} leaderboard={leaderboard} />

        <PortalTopBar
          currentEmail={admin.email}
          roster={roster}
          initialConversations={conversations.map((c) => ({
            email: c.email,
            lastBody: c.lastBody,
            lastAt: c.lastAt.toISOString(),
            unreadCount: c.unreadCount,
          }))}
        />

        {children}
      </div>
    </div>
  );
}
