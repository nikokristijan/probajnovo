/**
 * Dijeljene funkcije za Portal (Faza 3) — boja/inicijali avatara, oznaka
 * imena. Isti hash kao OfficePresence.tsx colorFor (namjerno identičan
 * algoritam preko cijelog Portala — isti kolega mora imati istu boju u
 * Uredu, chat avataru i profilu, ne tri različite boje na tri mjesta).
 */

export type PortalMember = { email: string; displayName?: string | null };

function hashStr(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

export function colorFor(email: string): string {
  const hue = hashStr(email) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

export function labelForEmail(email: string, roster?: PortalMember[]): string {
  const dn = roster?.find((m) => m.email === email)?.displayName?.trim();
  return dn && dn.length > 0 ? dn : email.split("@")[0];
}

export function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("hr-HR", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
}

export function formatConversationTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("hr-HR", { day: "numeric", month: "short" });
}

/* --- Datumi u chatu (plan #61) ---------------------------------------- */

/** "YYYY-MM-DD" po hrvatskom vremenu — ključ za razdjelnik dana. */
export function msgDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Zagreb" });
}

/** "Danas", "Jučer" ili "28. 9." (s godinom ako nije ova). */
export function formatMsgDayLabel(iso: string): string {
  const key = msgDayKey(iso);
  const now = new Date();
  const today = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Zagreb" });
  const yesterday = new Date(now.getTime() - 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Zagreb" });
  if (key === today) return "Danas";
  if (key === yesterday) return "Jučer";
  const [y, m, d] = key.split("-").map(Number);
  return y === Number(today.slice(0, 4)) ? `${d}. ${m}.` : `${d}. ${m}. ${y}.`;
}

/** Samo sat i minuta ("14:05"), po hrvatskom vremenu. */
export function formatMsgClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("hr-HR", { timeZone: "Europe/Zagreb", hour: "2-digit", minute: "2-digit" });
}

/** Grupiranje poruka kao u Slacku: isti pošiljatelj, isti dan i najviše
    10 minuta razmaka. Svaka grupa zna treba li iznad sebe razdjelnik dana. */
export function groupMessagesByDay<T extends { createdAt: string }>(
  items: T[],
  senderOf: (item: T) => string
): { sender: string; day: string; showDay: boolean; items: T[] }[] {
  const groups: { sender: string; day: string; showDay: boolean; items: T[] }[] = [];
  for (const item of items) {
    const day = msgDayKey(item.createdAt);
    const sender = senderOf(item);
    const last = groups[groups.length - 1];
    const lastItem = last?.items[last.items.length - 1];
    const closeInTime =
      lastItem && new Date(item.createdAt).getTime() - new Date(lastItem.createdAt).getTime() <= 10 * 60_000;
    if (last && last.sender === sender && last.day === day && closeInTime) {
      last.items.push(item);
    } else {
      groups.push({ sender, day, showDay: !last || last.day !== day, items: [item] });
    }
  }
  return groups;
}
