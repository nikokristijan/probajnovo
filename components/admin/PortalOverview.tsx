"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { colorFor, initialsFor, labelForEmail, type PortalMember } from "@/components/admin/portalUtils";
import { formatShortDateZagreb, formatBirthdayZagreb } from "@/lib/date";
import {
  SearchIcon,
  ActivityIcon,
  GiftIcon,
  CalendarIcon,
  InboxIcon,
  BedIcon,
} from "@/components/admin/Icons";

type UpcomingReservation = {
  id: number;
  propertyId: number;
  propertyName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number | null;
};

type ActivityItem = {
  id: number;
  adminEmail: string;
  action: string;
  targetLabel: string;
  propertyName: string | null;
  createdAt: string;
};

type Birthday = { email: string; label: string; birthday: string; daysUntil: number };

const ACTION_LABELS: Record<string, string> = {
  created_reservation: "Nova rezervacija",
  deleted_reservation: "Obrisana rezervacija",
  created_expense: "Novi trošak",
  deleted_expense: "Obrisan trošak",
};

function birthdayLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Danas";
  if (daysUntil === 1) return "Sutra";
  return `Za ${daysUntil} ${daysUntil < 5 ? "dana" : "dana"}`;
}

/**
 * Jedinstveni pregled Portala (NOVO/Revolut redizajn, Task #24) — zamjena
 * za raniji PortalMain.tsx (koji je SAMO prebacivao vidljivost triju
 * gotovih slotova preko ?tab=). Ovdje se svi slotovi prikazuju ISTOVREMENO
 * na jednoj stranici ("jedan veliki pregled"), uz nove widgete koji nisu
 * postojali prije: pretraga (preko tima/vikendica/nadolazećih rezervacija,
 * čisto klijentsko filtriranje već dohvaćenih podataka — nema posebne
 * pretraživačke rute), brze poveznice na ostale admin sekcije, nadolazeće
 * rezervacije preko svih vikendica, rođendani tima i sažeta aktivnost.
 * channelSlot/tasksSlot/statsSlot i dalje dolaze GOTOVI s poslužitelja
 * (app/admin/portal/page.tsx) — ova komponenta ih samo raspoređuje, ne zna
 * ništa o njihovim podacima (isti princip kao raniji PortalMain).
 */
export default function PortalOverview({
  currentEmail,
  properties,
  roster,
  messageCounts,
  statusCounts,
  upcomingReservations,
  recentActivity,
  birthdays,
  channelSlot,
  tasksSlot,
  statsSlot,
}: {
  currentEmail: string;
  properties: { id: number; name: string }[];
  roster: PortalMember[];
  messageCounts: { dateKey: string; count: number }[];
  statusCounts: { status: string; count: number }[];
  upcomingReservations: UpcomingReservation[];
  recentActivity: ActivityItem[];
  birthdays: Birthday[];
  channelSlot: ReactNode;
  tasksSlot: ReactNode;
  statsSlot: ReactNode;
}) {
  const [query, setQuery] = useState("");

  const totalMessages7d = messageCounts.reduce((sum, d) => sum + d.count, 0);
  const openTasks = statusCounts.filter((s) => s.status !== "done").reduce((sum, s) => sum + s.count, 0);
  const doneTasks = statusCounts.find((s) => s.status === "done")?.count ?? 0;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const people = roster.filter(
      (m) => m.email !== currentEmail && (labelForEmail(m.email, roster).toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    );
    const props = properties.filter((p) => p.name.toLowerCase().includes(q));
    const reservations = upcomingReservations.filter(
      (r) => r.guestName.toLowerCase().includes(q) || r.propertyName.toLowerCase().includes(q)
    );
    return { people, props, reservations, empty: people.length === 0 && props.length === 0 && reservations.length === 0 };
  }, [query, roster, properties, upcomingReservations, currentEmail]);

  return (
    <div className="flex flex-col gap-5">
      {/* Pretraga — čisto klijentsko filtriranje već dohvaćenih podataka
          (tim/vikendice/nadolazeće rezervacije), vidi komentar gore. */}
      <div className="na-card relative px-3 py-2.5 flex items-center gap-2.5">
        <SearchIcon size={17} className="shrink-0 text-[var(--na-ink-faintest)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pretraži kolege, vikendice, goste…"
          className="flex-1 bg-transparent outline-none"
          style={{ fontSize: 14, color: "var(--na-ink)" }}
        />
        {results && (
          <div className="na-card absolute left-0 right-0 top-[calc(100%+6px)] z-10 p-2 flex flex-col gap-1 max-h-80 overflow-y-auto">
            {results.empty && (
              <p className="text-sm px-2 py-2" style={{ color: "var(--na-ink-faint)" }}>
                Nema rezultata za &ldquo;{query}&rdquo;.
              </p>
            )}
            {results.people.map((m) => {
              const label = labelForEmail(m.email, roster);
              return (
                <Link key={m.email} href={`/admin/portal/dm/${encodeURIComponent(m.email)}`} className="na-card-interactive flex items-center gap-2 px-2 py-1.5 rounded-xl">
                  <span className="portal-nav-avatar" style={{ background: colorFor(m.email) }}>{initialsFor(label)}</span>
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="na-chip ml-auto" style={{ border: "none" }}>kolega</span>
                </Link>
              );
            })}
            {results.reservations.map((r) => (
              <Link key={r.id} href={`/admin/kalendar?property=${r.propertyId}`} className="na-card-interactive flex items-center gap-2 px-2 py-1.5 rounded-xl">
                <BedIcon size={16} className="text-[var(--na-accent)]" />
                <span className="text-sm font-semibold">{r.guestName}</span>
                <span className="text-xs" style={{ color: "var(--na-ink-faint)" }}>{r.propertyName} · {formatShortDateZagreb(r.checkIn)}</span>
              </Link>
            ))}
            {results.props.map((p) => (
              <Link key={p.id} href={`/admin/kalendar?property=${p.id}`} className="na-card-interactive flex items-center gap-2 px-2 py-1.5 rounded-xl">
                <CalendarIcon size={16} className="text-[var(--na-accent)]" />
                <span className="text-sm font-semibold">{p.name}</span>
                <span className="na-chip ml-auto" style={{ border: "none" }}>vikendica</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Brze poveznice na ostale admin sekcije. */}
      {/* Na mobitelu 4 jednaka stupca (ikona iznad natpisa) umjesto reda
          pilula koji se lomio pa je "Aktivnost" ostajala sama u drugom redu. */}
      <div className="portal-quicklinks">
        <Link href="/admin/inquiries" className="portal-quicklink"><InboxIcon size={16} /> <span>Upiti</span></Link>
        <Link href="/admin/rezervacije" className="portal-quicklink"><BedIcon size={16} /> <span>Rezervacije</span></Link>
        <Link href="/admin/kalendar" className="portal-quicklink"><CalendarIcon size={16} /> <span>Kalendar</span></Link>
        <Link href="/admin/aktivnost" className="portal-quicklink"><ActivityIcon size={16} /> <span>Aktivnost</span></Link>
      </div>

      {/* Sažete brojke — zamjena za "morate otvoriti Statistiku da vidite
          osnovno" osjećaj, ovo je uvijek vidljivo na vrhu. */}
      {/* Kraći natpisi da na mobitelu (3 uska stupca) stanu u jedan red —
          ranije se "Poruke (7 dana)" / "Otvoreni zadaci" lomilo u dva reda pa
          brojke ispod nisu bile u istoj visini. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="na-card portal-stat-tile">
          <span className="na-kicker">Poruke · 7d</span>
          <div className="na-stat-value">{totalMessages7d}</div>
        </div>
        <div className="na-card portal-stat-tile">
          <span className="na-kicker">Otvoreno</span>
          <div className="na-stat-value">{openTasks}</div>
        </div>
        <div className="na-card portal-stat-tile">
          <span className="na-kicker">Završeno</span>
          <div className="na-stat-value">{doneTasks}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          <h2 className="na-heading text-base">Zadaci</h2>
          {tasksSlot}
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <div className="na-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <BedIcon size={16} className="text-[var(--na-accent)]" />
              <h3 className="na-heading text-sm">Nadolazeće</h3>
            </div>
            {upcomingReservations.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--na-ink-faint)" }}>Nema nadolazećih rezervacija.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {upcomingReservations.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.guestName}</p>
                      <p className="text-xs truncate" style={{ color: "var(--na-ink-faint)" }}>{r.propertyName}</p>
                    </div>
                    <span className="na-chip shrink-0">{formatShortDateZagreb(r.checkIn)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="na-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <GiftIcon size={16} className="text-[var(--na-accent)]" />
              <h3 className="na-heading text-sm">Rođendani</h3>
            </div>
            {birthdays.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--na-ink-faint)" }}>Nitko još nije upisao rođendan na profilu.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {birthdays.map((b) => (
                  <div key={b.email} className="flex items-center gap-2.5">
                    <span className="portal-nav-avatar" style={{ background: colorFor(b.email) }}>{initialsFor(b.label)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{b.label}</p>
                      <p className="text-xs" style={{ color: "var(--na-ink-faint)" }}>{formatBirthdayZagreb(b.birthday)}</p>
                    </div>
                    <span className="na-chip shrink-0">{birthdayLabel(b.daysUntil)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="na-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ActivityIcon size={16} className="text-[var(--na-accent)]" />
                <h3 className="na-heading text-sm">Aktivnost</h3>
              </div>
              <Link href="/admin/aktivnost" className="text-xs font-semibold" style={{ color: "var(--na-accent)" }}>
                Sve →
              </Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--na-ink-faint)" }}>Još nema zabilježenih radnji.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recentActivity.map((e) => (
                  <div key={e.id} className="text-xs">
                    <span className="font-semibold">{ACTION_LABELS[e.action] ?? e.action}</span>{" "}
                    <span style={{ color: "var(--na-ink-faint)" }}>
                      {e.targetLabel}
                      {e.propertyName && ` · ${e.propertyName}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="na-heading text-base">Tim chat</h2>
        {/* Nit (.portal-thread) je sama kartica s rubom — ranije je bila
            umotana u još jedan .na-card p-4, pa je chat imao dvostruki okvir. */}
        {channelSlot}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="na-heading text-base">Statistika</h2>
        {statsSlot}
      </div>
    </div>
  );
}
