import { requireFullAdmin } from "@/lib/auth";
import { listRecentActivity, listProperties } from "@/lib/db/queries";

const ACTION_LABELS: Record<string, string> = {
  created_reservation: "Nova rezervacija",
  deleted_reservation: "Obrisana rezervacija",
  created_expense: "Novi trošak",
  deleted_expense: "Obrisan trošak",
};

/**
 * Log aktivnosti — samo za pune admine, namjerno ograničen na rezervacije/
 * troškove (ne cijeli sustav retroaktivno), vidi lib/db/schema.ts activityLog
 * i logActivity pozive u lib/actions.ts. Nadzor tko je (uključujući vlasnike)
 * što radio, npr. tko je obrisao rezervaciju.
 */
export default async function AdminActivityLogPage() {
  await requireFullAdmin();

  const [entries, properties] = await Promise.all([listRecentActivity(200), listProperties()]);
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Aktivnost</h1>
        <p className="text-xs text-black/50 mt-0.5">
          Zadnjih {entries.length} radnji nad rezervacijama i troškovima (svi admini i vlasnici).
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-black/60">Još nema zabilježenih radnji.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
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
                  <span className="text-xs text-black/40 ml-2">· {propertyNameById.get(e.propertyId)}</span>
                )}
              </div>
              <div className="text-xs text-black/40 shrink-0 ml-3">
                {e.adminEmail} · {e.createdAt.toLocaleString("hr-HR")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
