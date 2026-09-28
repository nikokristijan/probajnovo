import { requireFullAdmin } from "@/lib/auth";
import { listTeamMessages, listTeamMembers } from "@/lib/db/queries";
import TeamMessageForm from "@/components/admin/TeamMessageForm";
import EmptyState from "@/components/admin/EmptyState";
import OfficePresence from "@/components/admin/OfficePresence";
import { ChatIcon } from "@/components/admin/Icons";

/** "YYYY-MM-DD" u Europe/Zagreb — isti obrazac kao app/admin/aktivnost
    zagrebDayKey, namjerno duplicirano lokalno (mala funkcija, aktivnost
    stranica nije još migrirana na neumorphism pa je ne diramo ovdje). */
function zagrebDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function todayKeyZagreb(): string {
  return zagrebDayKey(new Date());
}

function yesterdayKeyZagreb(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return zagrebDayKey(d);
}

function dayHeaderLabel(dayKey: string, todayKey: string, yesterdayKey: string): string {
  if (dayKey === todayKey) return "Danas";
  if (dayKey === yesterdayKey) return "Jučer";
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Interni feed tima (Faza 2) — jednostavan kronološki "chat" (na izričit
 * zahtjev: "interni feed/chat tima... jednostavan kronološki feed, ne
 * pravi real-time chat"), bez WebSocketa/pollinga — osvježava se kao i
 * ostatak admina preko revalidatePath pri slanju. Dostupno svim punim
 * adminima/superadminima, nikad vlasnicima.
 */
export default async function TeamMessagesPage() {
  await requireFullAdmin();
  const [messages, members] = await Promise.all([listTeamMessages(), listTeamMembers()]);

  const officeMembers = members.map((m) => ({
    email: m.email,
    isSuperAdmin: m.isSuperAdmin,
    lastSeenAt: m.lastSeenAt ? m.lastSeenAt.toISOString() : null,
  }));

  const todayKey = todayKeyZagreb();
  const yesterdayKey = yesterdayKeyZagreb();

  const groups: { dayKey: string; items: typeof messages }[] = [];
  for (const m of messages) {
    const dayKey = zagrebDayKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) last.items.push(m);
    else groups.push({ dayKey, items: [m] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ChatIcon className="text-[#ff7f00]" />
          Poruke
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--neu-ink-faint)" }}>
          Interni feed agencijskog tima — vidljiv svim adminima, ne šalje se klijentima.
        </p>
      </div>

      <OfficePresence initialMembers={officeMembers} />

      {messages.length === 0 ? (
        <EmptyState title="Još nema poruka." hint="Napiši prvu poruku timu ispod." />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.dayKey} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
                {dayHeaderLabel(g.dayKey, todayKey, yesterdayKey)}
              </span>
              {g.items.map((m) => (
                <div key={m.id} className="neu-card px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-semibold">{m.adminEmail}</span>
                    <span className="text-[11px] shrink-0" style={{ color: "var(--neu-ink-faint)" }}>
                      {m.createdAt.toLocaleTimeString("hr-HR", { timeZone: "Europe/Zagreb", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <TeamMessageForm redirectTo="/admin/poruke" />
    </div>
  );
}
