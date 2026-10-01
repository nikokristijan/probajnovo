import Link from "next/link";
import type { AdminUser } from "@/lib/db/schema";
import { getSuperadminToday, listSubscriptions } from "@/lib/db/queries";
import { greetingZagreb, todayDateStringZagreb } from "@/lib/date";
import { describeSubscription } from "@/lib/subscriptionState";

type Line = { key: string; text: string; href: string; tone?: "warn" | "bad" };

function names(list: { guestName: string; propertyName: string }[]): string {
  if (list.length === 1) return `${list[0].guestName} (${list[0].propertyName})`;
  return `${list.length} gosta`;
}

/**
 * Jutarnji pregled za tim (plan #27): što danas treba napraviti, svaki red
 * vodi točno tamo gdje se to rješava. Prazan dan = jedna mirna rečenica.
 */
export default async function SuperadminToday({ admin }: { admin: AdminUser }) {
  const today = todayDateStringZagreb();
  const [t, subs] = await Promise.all([
    getSuperadminToday(admin.email),
    admin.isSuperAdmin ? listSubscriptions() : Promise.resolve([]),
  ]);
  const late = subs
    .map((s) => ({ s, st: describeSubscription(s, today) }))
    .filter((x) => x.st.needsPayment);

  const lines: Line[] = [];
  if (t.unansweredInquiries > 0) {
    const old = t.oldestUnansweredHours != null && t.oldestUnansweredHours >= 24;
    lines.push({
      key: "upiti",
      text:
        (t.unansweredInquiries === 1 ? "1 upit čeka odgovor" : `${t.unansweredInquiries} upita čeka odgovor`) +
        (old ? ` — najstariji ${Math.floor(t.oldestUnansweredHours! / 24)} d` : ""),
      href: "/admin/inquiries",
      tone: old ? "bad" : "warn",
    });
  }
  if (t.arrivals.length > 0)
    lines.push({ key: "dolasci", text: `Danas dolazi ${names(t.arrivals)}`, href: `/admin/rezervacije?property=${t.arrivals[0].propertyId}` });
  if (t.departures.length > 0)
    lines.push({ key: "odlasci", text: `Danas odlazi ${names(t.departures)}`, href: `/admin/rezervacije?property=${t.departures[0].propertyId}` });
  for (const task of t.myTasksDue.slice(0, 3)) {
    lines.push({
      key: `task-${task.id}`,
      text: `Zadatak: ${task.title}${task.dueDate && task.dueDate < today ? " (kasni)" : ""}`,
      href: "/admin/portal",
      tone: task.dueDate && task.dueDate < today ? "warn" : undefined,
    });
  }
  if (t.myTasksDue.length > 3) lines.push({ key: "task-more", text: `+ još ${t.myTasksDue.length - 3} zadatka`, href: "/admin/portal" });
  if (late.length > 0) {
    const worst = late.reduce((a, b) => (b.st.daysLate > a.st.daysLate ? b : a));
    lines.push({
      key: "uplate",
      text:
        late.length === 1
          ? `Uplata: ${worst.s.sourceName} — ${worst.st.label.toLowerCase()}`
          : `${late.length} pretplate čekaju uplatu (${worst.s.sourceName}: ${worst.st.label.toLowerCase()})`,
      href: late.length === 1 ? `/admin/financije/${worst.s.id}` : "/admin/financije",
      tone: worst.st.daysLate > 14 ? "bad" : "warn",
    });
  }

  const firstName = admin.displayName?.trim().split(/\s+/)[0] ?? null;

  return (
    <section className="today-panel" aria-labelledby="danas-naslov">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 id="danas-naslov" className="text-xl font-bold">
            {greetingZagreb()}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="text-sm text-black/70 mt-0.5">
            {lines.length === 0 ? "Danas nema ništa hitno — nema dolazaka, upita ni uplata koje čekaju." : "Ovo je danas na redu:"}
          </p>
        </div>
        {admin.isSuperAdmin && (
          <Link href="/admin/novi-klijent" className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 shrink-0">
            + Novi klijent
          </Link>
        )}
      </div>
      {lines.length > 0 && (
        <ul className="today-list">
          {lines.map((l) => (
            <li key={l.key}>
              <Link href={l.href} className={"today-item" + (l.tone ? ` is-${l.tone}` : "")}>
                <span>{l.text}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
