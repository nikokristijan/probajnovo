import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { listActivityPage, listProperties } from "@/lib/db/queries";
import Pagination from "@/components/admin/Pagination";
import { todayDateStringZagreb, dateStringOffsetFromTodayZagreb } from "@/lib/date";

const ACTION_LABELS: Record<string, string> = {
  created_reservation: "Nova rezervacija",
  deleted_reservation: "Obrisana rezervacija",
  updated_reservation: "Uređena rezervacija",
  replied_inquiry: "Odgovor na upit",
  created_expense: "Novi trošak",
  deleted_expense: "Obrisan trošak",
  invited_admin: "Pozivnica poslana",
  accepted_invite: "Pozivnica prihvaćena",
  sent_password_link: "Link za lozinku",
  updated_admin: "Uređen račun",
  reset_2fa: "Isključen 2FA",
  recorded_payment: "Uplata pretplate",
  created_client: "Novi klijent",
};

const PAGE_SIZE = 50;

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
  searchParams: Promise<{ property?: string; action?: string; q?: string; page?: string }>;
}) {
  await requireFullAdmin();
  const sp = await searchParams;
  const selectedPropertyId = sp.property ? Number(sp.property) || null : null;
  const action = sp.action && ACTION_LABELS[sp.action] ? sp.action : null;
  const q = sp.q?.trim().slice(0, 80) || null;
  const page = Math.max(1, Number(sp.page) || 1);

  // Plan #24: filtriranje i stranice u bazi, ne "zadnjih 200 pa filtriraj".
  const [{ rows: entries, total }, properties] = await Promise.all([
    listActivityPage({ propertyId: selectedPropertyId, action, q, page, pageSize: PAGE_SIZE }),
    listProperties(),
  ]);
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
  const filtered = Boolean(selectedPropertyId || action || q);

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
        <p className="text-xs text-black/60 mt-0.5">
          Tko je što napravio: rezervacije, troškovi, uplate, pozivnice i računi.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <label className="flex flex-col gap-1 text-xs font-semibold text-black/60">
          Pretraga
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="gost, e-mail, klijent…"
            className="admin-input text-sm font-normal w-56 max-w-full"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-black/60">
          Radnja
          <select name="action" defaultValue={action ?? ""} className="admin-input text-sm font-normal">
            <option value="">Sve radnje</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {properties.length > 1 && (
          <label className="flex flex-col gap-1 text-xs font-semibold text-black/60">
            Vikendica
            <select name="property" defaultValue={selectedPropertyId ?? ""} className="admin-input text-sm font-normal">
              <option value="">Sve vikendice</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded-full bg-black text-white text-xs font-semibold px-4 py-2">
          Filtriraj
        </button>
        {filtered && (
          <Link href="/admin/aktivnost" className="text-xs font-semibold px-3 py-2 text-black/70 hover:text-black">
            Očisti
          </Link>
        )}
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-black/60">
          {filtered ? "Nijedna radnja ne odgovara filtru." : "Još nema zabilježenih radnji."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.dayKey} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-black/60">
                {dayHeaderLabel(g.dayKey, todayKey, yesterdayKey)}
              </span>
              {g.items.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap border border-black/10 rounded-xl px-4 py-2.5 bg-white"
                >
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/5 text-black/60 mr-2">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="text-sm">{e.targetLabel}</span>
                    {e.propertyId != null && propertyNameById.has(e.propertyId) && (
                      <span className="text-xs text-black/60 ml-2">
                        · {propertyNameById.get(e.propertyId)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-black/60 shrink-0">
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
      <Pagination
        basePath="/admin/aktivnost"
        params={{ q: q ?? undefined, action: action ?? undefined, property: selectedPropertyId ? String(selectedPropertyId) : undefined }}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}
