"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { colorFor, initialsFor, labelForEmail, formatConversationTime, type PortalMember } from "@/components/admin/portalUtils";
import { ChecklistIcon, ChartIcon, HashIcon, UserIcon } from "@/components/admin/Icons";

type Conversation = { email: string; lastBody: string; lastAt: string; unreadCount: number };

const POLL_MS = 8_000;

/**
 * Bočni izbornik Portala (Faza 3) — Slack/Teams-stil app-shell: "Kanali"
 * (Tim/Zadaci/Statistika, prebacuju glavni sadržaj preko ?tab= bez punog
 * reloada — vidi PortalMain.tsx) + "Izravne poruke" (jedan redak po članu
 * tima, zadnja poruka + broj nepročitanih, poveznica na /admin/portal/dm/
 * [email]). Popis razgovora pollan sporije (~8s) od same otvorene niti
 * (samo treba znati "ima nešto novo", ne prikazuje svaku poruku uživo).
 */
export default function PortalSidebar({
  currentEmail,
  roster,
  initialConversations,
}: {
  currentEmail: string;
  roster: PortalMember[];
  initialConversations: Conversation[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "poruke";
  const [conversations, setConversations] = useState(initialConversations);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/portal/conversations", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.conversations)) setConversations(data.conversations);
      } catch {
        // Tiho ignoriraj.
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const convByEmail = new Map(conversations.map((c) => [c.email, c]));
  const others = roster.filter((m) => m.email !== currentEmail);
  const dmList = others
    .map((m) => ({ member: m, conv: convByEmail.get(m.email) ?? null }))
    .sort((a, b) => {
      const ua = a.conv?.unreadCount ?? 0;
      const ub = b.conv?.unreadCount ?? 0;
      if (ua !== ub) return ub - ua;
      const ta = a.conv ? new Date(a.conv.lastAt).getTime() : 0;
      const tb = b.conv ? new Date(b.conv.lastAt).getTime() : 0;
      if (ta !== tb) return tb - ta;
      return labelForEmail(a.member.email, roster).localeCompare(labelForEmail(b.member.email, roster));
    });

  const isChannel = pathname === "/admin/portal" && (activeTab === "poruke" || !searchParams.get("tab"));
  const isTasks = pathname === "/admin/portal" && activeTab === "zadaci";
  const isStats = pathname === "/admin/portal" && activeTab === "statistika";
  const isProfile = pathname === `/admin/portal/profil/${encodeURIComponent(currentEmail)}`;

  return (
    <aside className="portal-sidebar">
      <nav className="portal-nav-group">
        <span className="portal-nav-label">Kanali</span>
        <Link href="/admin/portal?tab=poruke" className={`portal-nav-item ${isChannel ? "is-active" : ""}`}>
          <HashIcon />
          <span className="portal-nav-item-label">Tim</span>
        </Link>
        <Link href="/admin/portal?tab=zadaci" className={`portal-nav-item ${isTasks ? "is-active" : ""}`}>
          <ChecklistIcon size={15} />
          <span className="portal-nav-item-label">Zadaci</span>
        </Link>
        <Link href="/admin/portal?tab=statistika" className={`portal-nav-item ${isStats ? "is-active" : ""}`}>
          <ChartIcon size={15} />
          <span className="portal-nav-item-label">Statistika</span>
        </Link>
      </nav>

      <nav className="portal-nav-group">
        <span className="portal-nav-label">Izravne poruke</span>
        {dmList.map(({ member, conv }) => {
          const label = labelForEmail(member.email, roster);
          const active = pathname === `/admin/portal/dm/${encodeURIComponent(member.email)}`;
          return (
            <Link
              key={member.email}
              href={`/admin/portal/dm/${encodeURIComponent(member.email)}`}
              className={`portal-nav-item ${active ? "is-active" : ""}`}
              title={conv ? conv.lastBody : "Još nema poruka"}
            >
              <span className="portal-nav-avatar" style={{ background: colorFor(member.email) }}>
                {initialsFor(label)}
              </span>
              <span className="portal-nav-item-label">{label}</span>
              {conv && (
                <span className="portal-nav-time" style={{ fontSize: 10, color: "var(--neu-ink-faint)", flexShrink: 0 }}>
                  {formatConversationTime(conv.lastAt)}
                </span>
              )}
              {conv && conv.unreadCount > 0 && <span className="portal-nav-badge">{conv.unreadCount}</span>}
            </Link>
          );
        })}
      </nav>

      <nav className="portal-nav-group">
        <span className="portal-nav-label">Ja</span>
        <Link
          href={`/admin/portal/profil/${encodeURIComponent(currentEmail)}`}
          className={`portal-nav-item ${isProfile ? "is-active" : ""}`}
        >
          <UserIcon size={15} />
          <span className="portal-nav-item-label">Moj profil</span>
        </Link>
      </nav>
    </aside>
  );
}
