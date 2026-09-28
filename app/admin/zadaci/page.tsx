import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { listTeamTasks, listTeamMembers, listProperties, listCompanies } from "@/lib/db/queries";
import { updateTeamTaskStatusAction } from "@/lib/actions";
import TeamTaskForm from "@/components/admin/TeamTaskForm";
import TeamTaskAssignSelect from "@/components/admin/TeamTaskAssignSelect";
import DeleteTeamTaskButton from "@/components/admin/DeleteTeamTaskButton";
import EmptyState from "@/components/admin/EmptyState";
import { ChecklistIcon } from "@/components/admin/Icons";
import { todayDateStringZagreb } from "@/lib/date";
import type { TeamTask } from "@/lib/db/schema";

const COLUMNS: { status: TeamTask["status"]; label: string; nextStatus: TeamTask["status"] | null; nextLabel: string }[] = [
  { status: "todo", label: "Za napraviti", nextStatus: "in_progress", nextLabel: "Počni →" },
  { status: "in_progress", label: "U tijeku", nextStatus: "done", nextLabel: "Završi →" },
  { status: "done", label: "Gotovo", nextStatus: null, nextLabel: "" },
];

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC", day: "numeric", month: "short" });
}

/**
 * Tim zadaci (Faza 2) — jednostavan Kanban (3 stupca, bez drag-and-drop
 * biblioteke, samo gumb "dalje" po statusu — vidi updateTeamTaskStatusAction).
 * Dostupno svim punim adminima/superadminima, vidljivo/dodjeljivo svima
 * (na izričit zahtjev), NIKAD vlasnicima — requireFullAdmin ih već
 * preusmjerava. Reference: pregledao sam Plane (makleplane/plane, 30k+
 * zvjezdica, Next.js frontend) za Kanban/status/prioritet obrazac prije
 * gradnje ovoga — namjerno pojednostavljeno (bez sprintova/epics/labela)
 * jer ih agencijski tim od par ljudi ne treba.
 */
export default async function TeamTasksPage() {
  await requireFullAdmin();

  const [tasks, teamMembers, properties, companies] = await Promise.all([
    listTeamTasks(),
    listTeamMembers(),
    listProperties(),
    listCompanies(),
  ]);

  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
  const companyNameById = new Map(companies.map((c) => [c.id, c.name]));
  const today = todayDateStringZagreb();

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: tasks.filter((t) => t.status === col.status),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ChecklistIcon className="text-[#ff7f00]" />
          Zadaci
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--neu-ink-faint)" }}>
          Interni zadaci agencijskog tima — vidljivi svim adminima, dodjeljuju se jedni drugima ili ostaju
          otvoreni za preuzeti.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 admin-animate-grid">
        {grouped.map((col) => (
          <section key={col.status} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
                {col.label}
              </h2>
              <span className="text-xs tabular-nums" style={{ color: "var(--neu-ink-faint)" }}>
                {col.items.length}
              </span>
            </div>

            {col.items.length === 0 ? (
              <EmptyState title="Prazno." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {col.items.map((task) => {
                  const clientName =
                    task.propertyId != null
                      ? propertyNameById.get(task.propertyId)
                      : task.companyId != null
                        ? companyNameById.get(task.companyId)
                        : null;
                  const clientHref =
                    task.propertyId != null
                      ? `/admin/vikendice/${task.propertyId}`
                      : task.companyId != null
                        ? `/admin/companies/${task.companyId}`
                        : null;
                  const isOverdue = task.dueDate != null && task.dueDate < today && task.status !== "done";

                  return (
                    <div key={task.id} className="neu-card p-4 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold leading-snug">{task.title}</span>
                        {task.priority === "high" && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 shrink-0">
                            Visok
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs leading-relaxed" style={{ color: "var(--neu-ink-faint)" }}>
                          {task.description}
                        </p>
                      )}

                      {clientName && clientHref && (
                        <Link href={clientHref} className="text-xs font-medium text-[#ff7f00] underline w-fit">
                          {clientName}
                        </Link>
                      )}

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <TeamTaskAssignSelect taskId={task.id} currentEmail={task.assignedToEmail} teamMembers={teamMembers} />
                        {task.dueDate && (
                          <span className={"text-[11px] font-medium " + (isOverdue ? "text-red-600" : "")} style={isOverdue ? undefined : { color: "var(--neu-ink-faint)" }}>
                            {isOverdue ? "Kasni · " : "Rok "}
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {col.nextStatus ? (
                          <form action={updateTeamTaskStatusAction.bind(null, task.id, col.nextStatus)}>
                            <button type="submit" className="admin-quicklink !py-1 !px-3 !text-xs">
                              {col.nextLabel}
                            </button>
                          </form>
                        ) : (
                          <span className="text-[11px] font-medium" style={{ color: "var(--neu-ink-faint)" }}>
                            {task.completedAt?.toLocaleDateString("hr-HR")}
                          </span>
                        )}
                        <DeleteTeamTaskButton id={task.id} title={task.title} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <TeamTaskForm
        teamMembers={teamMembers.map((m) => ({ email: m.email }))}
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
