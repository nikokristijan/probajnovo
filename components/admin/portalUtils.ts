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
