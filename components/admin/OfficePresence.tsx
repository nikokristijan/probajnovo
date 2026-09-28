"use client";

import { useEffect, useState } from "react";
import { MonitorIcon, CupIcon, MoonIcon } from "@/components/admin/Icons";

type Member = { email: string; isSuperAdmin: boolean; lastSeenAt: string | null };
type Status = "working" | "away" | "sleeping";

const POLL_MS = 20_000;
/** Pragovi statusa po proteklom vremenu od zadnjeg otkucaja (PresenceHeartbeat
    šalje otkucaj svake minute) — < 2 min "radi" (na desku, koristi admin),
    2-15 min "jede" (kratka pauza), inače/nikad "spava" (nije aktivan). */
const WORKING_MS = 2 * 60_000;
const AWAY_MS = 15 * 60_000;

function statusOf(lastSeenAt: string | null, now: number): Status {
  if (!lastSeenAt) return "sleeping";
  const diff = now - new Date(lastSeenAt).getTime();
  if (diff < WORKING_MS) return "working";
  if (diff < AWAY_MS) return "away";
  return "sleeping";
}

/** Deterministična "pikselizirana" boja avatara iz emaila — isti kolega
    uvijek ista boja, bez potrebe da itko bira/uploada avatar. */
function colorFor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 55%, 52%)`;
}

function labelFor(email: string): string {
  return email.split("@")[0];
}

const ZONES: { status: Status; key: string; label: string; icon: React.ReactNode; empty: string }[] = [
  { status: "working", key: "office-zone-working", label: "Radi", icon: <MonitorIcon />, empty: "Nitko trenutno ne radi u adminu." },
  { status: "away", key: "office-zone-away", label: "Jede", icon: <CupIcon />, empty: "Nitko na pauzi." },
  { status: "sleeping", key: "office-zone-sleeping", label: "Spava", icon: <MoonIcon />, empty: "Nitko offline." },
];

const BADGE_ICON: Record<Status, React.ReactNode> = {
  working: <MonitorIcon />,
  away: <CupIcon />,
  sleeping: <MoonIcon />,
};

/**
 * "Ured" — pikselizirani tlocrt tima (Faza 2), na izričit zahtjev: prikaz
 * tko je online/radi, tko je na pauzi ("jede"), tko je offline ("spava").
 * Status se izvodi iz PresenceHeartbeat otkucaja (lastSeenAt), pollano
 * ovdje svakih ~20s preko app/api/admin/presence — namjerno odvojeno od
 * poruka feeda ispod (koji ostaje bez pollinga, na izričit zahtjev
 * "jednostavan kronološki feed, ne pravi real-time chat"; Ured treba
 * osjećaj uživo jer je bit prikaza tko je TRENUTNO gdje).
 */
export default function OfficePresence({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/presence", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.members)) {
          setMembers(data.members);
          setNow(Date.now());
        }
      } catch {
        // Tiho ignoriraj — Ured nije kritična funkcija, stara stanja ostaju vidljiva.
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const byStatus: Record<Status, Member[]> = { working: [], away: [], sleeping: [] };
  for (const m of members) byStatus[statusOf(m.lastSeenAt, now)].push(m);

  return (
    <div className="office-scene">
      {ZONES.map((zone) => {
        const people = byStatus[zone.status];
        return (
          <div key={zone.key} className={`office-zone ${zone.key}`}>
            <div className="office-zone-label">
              <span className="office-zone-dot" />
              {zone.label}
              <span style={{ marginLeft: "auto", fontWeight: 400 }}>{people.length}</span>
            </div>
            <div className="office-floor" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="office-tile" />
              ))}
            </div>
            {people.length === 0 ? (
              <p className="office-empty">{zone.empty}</p>
            ) : (
              <div className="office-avatars">
                {people.map((m) => (
                  <div key={m.email} className="office-avatar" title={m.email}>
                    <div
                      className={`office-avatar-body is-${zone.status}`}
                      style={{ background: colorFor(m.email) }}
                    >
                      <div className="office-avatar-eyes">
                        <span />
                        <span />
                      </div>
                      <div className="office-avatar-badge">{BADGE_ICON[zone.status]}</div>
                    </div>
                    <span className="office-avatar-label">{labelFor(m.email)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
