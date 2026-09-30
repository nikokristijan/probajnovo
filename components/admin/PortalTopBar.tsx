"use client";

import { useVisiblePolling } from "@/components/admin/useVisiblePolling";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { colorFor, initialsFor, labelForEmail, formatConversationTime, type PortalMember } from "@/components/admin/portalUtils";
import { ChevronDownIcon, UserIcon } from "@/components/admin/Icons";

type Conversation = { email: string; lastBody: string; lastAt: string; unreadCount: number };

const POLL_MS = 8_000;

/**
 * Zamjena za raniji PortalSidebar.tsx (bočni izbornik) — NOVO/Revolut
 * redizajn ukida bočni stupac ("PORTAL nema sa strane..."), ali DM
 * razgovori i dalje trebaju način prebacivanja dostupan na SVAKOJ portal
 * ruti (i dok si već u jednom razgovoru). Rješenje: tanka vodoravna traka
 * ISPOD "Ureda" — link natrag na pregled (samo kad nisi na njemu), pa
 * vodoravno skrolajući niz kontakata (avatar + zadnja poruka + neproč.
 * bedž, isti Slack "recent DMs" obrazac kao prije, samo horizontalno
 * umjesto okomite liste), i "Moj profil" na kraju. Isti 8s poll kao
 * ranije PortalSidebar (samo treba znati "ima nešto novo", ne prikazuje
 * svaku poruku uživo).
 */
export default function PortalTopBar({
  currentEmail,
  roster,
  initialConversations,
}: {
  currentEmail: string;
  roster: PortalMember[];
  initialConversations: Conversation[];
}) {
  const pathname = usePathname();
  const [conversations, setConversations] = useState(initialConversations);
  const isHome = pathname === "/admin/portal";
  const isProfile = pathname === `/admin/portal/profil/${encodeURIComponent(currentEmail)}`;

  useVisiblePolling(async () => {
    try {
      const res = await fetch("/api/admin/portal/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.conversations)) {
        const next = JSON.stringify(data.conversations);
        setConversations((cur) => (JSON.stringify(cur) === next ? cur : data.conversations));
      }
    } catch {
      // Tiho ignoriraj.
    }
  }, POLL_MS);

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

  return (
    <div className="na-card flex items-center gap-3 px-3 py-2.5">
      {!isHome && (
        <Link href="/admin/portal" className="na-btn-ghost px-3 py-1.5 shrink-0" style={{ fontSize: 12.5 }}>
          <ChevronDownIcon size={12} className="rotate-90" /> Pregled
        </Link>
      )}
      {/* flex-1 min-w-0 — niz kontakata se skrola UNUTAR svog prostora, umjesto
          da ga "Moj profil" gumb na mobitelu prekrije (ime zadnjeg kontakta je
          bilo odrezano napola). */}
      <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: "thin" }}>
        {dmList.map(({ member, conv }) => {
          const label = labelForEmail(member.email, roster);
          const active = pathname === `/admin/portal/dm/${encodeURIComponent(member.email)}`;
          return (
            <Link
              key={member.email}
              href={`/admin/portal/dm/${encodeURIComponent(member.email)}`}
              className="portal-topbar-contact"
              data-active={active || undefined}
              title={conv ? conv.lastBody : "Još nema poruka"}
            >
              <span className="portal-nav-avatar" style={{ background: colorFor(member.email) }}>
                {initialsFor(label)}
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="font-semibold" style={{ fontSize: 12.5 }}>{label}</span>
                {conv && (
                  <span style={{ fontSize: 10.5, color: "var(--na-ink-faintest)" }}>
                    {formatConversationTime(conv.lastAt)}
                  </span>
                )}
              </span>
              {conv && conv.unreadCount > 0 && <span className="portal-nav-badge">{conv.unreadCount}</span>}
            </Link>
          );
        })}
      </div>
      <Link
        href={`/admin/portal/profil/${encodeURIComponent(currentEmail)}`}
        className="na-btn-ghost px-3 py-1.5 shrink-0 ml-auto"
        aria-label="Moj profil"
        data-active={isProfile || undefined}
        style={{ fontSize: 12.5 }}
      >
        <UserIcon size={14} /> <span className="hidden sm:inline">Moj profil</span>
      </Link>
    </div>
  );
}
