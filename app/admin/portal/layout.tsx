import { Suspense } from "react";
import { requireFullAdmin } from "@/lib/auth";
import { listTeamMembers, listDmConversations } from "@/lib/db/queries";
import OfficePresence from "@/components/admin/OfficePresence";
import PortalSidebar from "@/components/admin/PortalSidebar";
import { PortalIcon } from "@/components/admin/Icons";

/**
 * Portal (Faza 3) — dijeljena "app-shell" ljuska za /admin/portal (glavni
 * hub), /admin/portal/dm/[email] i /admin/portal/profil/[email]: "Ured"
 * prisutnost na vrhu (puna širina, vidi OfficePresence.tsx v3) + bočni
 * izbornik (kanali/DM/profil) koji ostaje isti dok se glavni sadržaj
 * mijenja — isti "persistent left rail" obrazac kao Slack/Teams. Cijeli
 * omotač koristi .admin-breakout da se rasporedi preko cijelog ekrana
 * ("Ne treba biti sve u sredini"), izlazeći iz dijeljenog max-w-4xl
 * <main> u app/admin/layout.tsx bez da se taj wrapper mijenja za ostalih
 * 27 admin stranica. requireFullAdmin već isključuje vlasnike.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireFullAdmin();

  const [teamMembers, conversations] = await Promise.all([
    listTeamMembers(),
    listDmConversations(admin.email),
  ]);

  const roster = teamMembers.map((m) => ({ email: m.email, displayName: m.displayName ?? null }));
  const officeMembers = teamMembers.map((m) => ({
    email: m.email,
    isSuperAdmin: m.isSuperAdmin,
    lastSeenAt: m.lastSeenAt ? m.lastSeenAt.toISOString() : null,
    displayName: m.displayName,
  }));

  return (
    <div className="admin-breakout">
      <div className="admin-breakout-inner flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <PortalIcon className="text-[#ff7f00]" />
            Portal
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--neu-ink-faint)" }}>
            Tim, zadaci, poruke i statistika agencije na jednom mjestu.
          </p>
        </div>

        <OfficePresence initialMembers={officeMembers} />

        <div className="portal-shell">
          {/* useSearchParams() unutar PortalSidebar (za isticanje aktivnog
              taba preko ?tab=) treba Suspense granicu — bez nje Next.js baca
              upozorenje o CSR bailoutu za cijelu rutu (vidi identičan
              slučaj u app/admin/portal/page.tsx PortalMain). */}
          <Suspense fallback={<aside className="portal-sidebar" />}>
            <PortalSidebar currentEmail={admin.email} roster={roster} initialConversations={conversations.map((c) => ({
              email: c.email,
              lastBody: c.lastBody,
              lastAt: c.lastAt.toISOString(),
              unreadCount: c.unreadCount,
            }))} />
          </Suspense>
          <div className="portal-main">{children}</div>
        </div>
      </div>
    </div>
  );
}
