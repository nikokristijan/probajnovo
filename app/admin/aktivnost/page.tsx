import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { listRecentActivity, listProperties } from "@/lib/db/queries";
import { todayDateStringZagreb, dateStringOffsetFromTodayZagreb } from "@/lib/date";

const ACTION_LABELS: Record<string, string> = {
  created_reservation: "Nova rezervacija",
  deleted_reservation: "Obrisana rezervacija",
  created_expense: "Novi trošak",
  deleted_expense: "Obrisan trošak",
};

/** "YYYY-MM-DD" za proizvoljni Date u Europe/Zagreb — isti obrazac kao
    lib/date.ts todayDateStringZagreb, ali za bilo koji trenutak (ne samo
    "sad"), da se zapisi mogu grupirati po hrvatskom kalendarskom danu. */
function zagrebDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayHeaderLabel(dayKey: string, todayKey: string, yesterdayKey: string): string {
  if (dayKey === todayKey) return "Danas";
  if (dayKey === yesterdayKey) return "Jučer";
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString("hr-HR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Log aktivnosti — samo za pune admine, namjerno ograničen na rezervacije/
 * troškove (ne cijeli sustav retroaktivno), vidi lib/db/schema.ts activityLog
 * i logActivity pozive u lib/actions.ts. Nadzor tko je (uključujući vlasnike)
 * što radio, npr. tko je obrisao rezervaciju.
 *
 * "Jasniji audit log" (val 5): vrijeme se sad prikazuje u hrvatskom vremenu
 * (server radi u UTC — isti bug obrazac kao ostale timezone popravke ranije
 * u projektu, vidi lib/date.ts), zapisi su grupirani po danu radi lakšeg
 * pregledavanja, i dodan je filter po vikendici da admin brzo provjeri samo
 * jednu (npr. nakon žalbe vlasnika).
 */
export default async function AdminActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  await requireFullAdmin();
  const sp = await searchParams;
  const selectedPropertyId = sp.property ? Number(sp.property) : null;

  const [allEntries, properties] = await Promise.all([listRecentActivity(200), listProperties()]);
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
  const entries = selectedPropertyId
    ? allEntries.filter((e) => e.propertyId === selectedPropertyId)
    : allEntries;

  const todayKey = todayDateStringZagreb();
  const yesterdayKey = dateStringOffsetFromTodayZagreb(-1);

  const groups: { dayKey: string; items: typeof entries }[] = [];
  for (const e of entries) {
    const dayKey = zagrebDayKey(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) last.items.push(e);
    else groups.push({ dayKey, items: [e] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Aktivnost</h1>
        <p className="text-xs text-black/50 mt-0.5">
          Zadnjih {allEntries.length} radnji nad rezervacijama i troškovima (svi admini i vlasnici).
        </p>
      </div>

      {properties.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/aktivnost"
            className={
              "text-xs font-semibold px-3 py-1.5 rounded-full border " +
              (selectedPropertyId === null
                ? "bg-black text-white border-black"
                : "border-black/15 hover:border-black/40")
            }
          >
            Sve vikendice
          </Link>
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/admin/aktivnost?property=${p.id}`}
              className={
                "text-xs font-semibold px-3 py-1.5 rounded-full border " +
                (p.id === selectedPropertyId
                  ? "bg-black text-white border-black"
                  : "border-black/15 hover:border-black/40")
              }
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-black/60">
          {selectedPropertyId ? "Nema zabilježenih radnji za ovu vikendicu." : "Još nema zabilježenih radnji."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.dayKey} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-black/40">
                {dayHeaderLabel(g.dayKey, todayKey, yesterdayKey)}
              </span>
              {g.items.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-2.5 bg-white"
                >
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/5 text-black/60 mr-2">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="text-sm">{e.targetLabel}</span>
                    {e.propertyId != null && propertyNameById.has(e.propertyId) && (
                      <span className="text-xs text-black/40 ml-2">
                        · {propertyNameById.get(e.propertyId)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-black/40 shrink-0 ml-3">
                    {e.adminEmail} ·{" "}
                    {e.createdAt.toLocaleTimeString("hr-HR", {
                      timeZone: "Europe/Zagreb",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
