import Link from "next/link";
import { updateTeamTaskStatusAction } from "@/lib/actions";
import TeamTaskForm from "@/components/admin/TeamTaskForm";
import TeamTaskAssignSelect from "@/components/admin/TeamTaskAssignSelect";
import DeleteTeamTaskButton from "@/components/admin/DeleteTeamTaskButton";
import EmptyState from "@/components/admin/EmptyState";
import { describeDueDateZagreb } from "@/lib/date";
import type { TeamTask, TaskTemplate } from "@/lib/db/schema";

const COLUMNS: { status: TeamTask["status"]; label: string; nextStatus: TeamTask["status"] | null; nextLabel: string }[] = [
  { status: "todo", label: "Za napraviti", nextStatus: "in_progress", nextLabel: "Počni →" },
  { status: "in_progress", label: "U tijeku", nextStatus: "done", nextLabel: "Završi →" },
  { status: "done", label: "Gotovo", nextStatus: null, nextLabel: "" },
];

/**
 * Kanban zadataka — isti sadržaj kao bivši app/admin/zadaci/page.tsx,
 * izvučen u samostalnu (server) komponentu da ga Portal (Faza 3, tab
 * "Zadaci") može prikazati bez posebne rute, vidi app/admin/portal/page.tsx
 * PortalOverview tasksSlot. Reference: Plane (makleplane/plane) Kanban obrazac,
 * namjerno pojednostavljeno (bez sprintova/epics/labela).
 */
export default function TasksBoard({
  tasks,
  teamMembers,
  properties,
  companies,
  templates,
}: {
  tasks: TeamTask[];
  teamMembers: { email: string }[];
  properties: { id: number; name: string }[];
  companies: { id: number; name: string }[];
  templates: TaskTemplate[];
}) {
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
  const companyNameById = new Map(companies.map((c) => [c.id, c.name]));

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: tasks.filter((t) => t.status === col.status),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 admin-animate-grid">
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
                  const dueInfo = task.dueDate ? describeDueDateZagreb(task.dueDate, task.status === "done") : null;

                  return (
                    <div key={task.id} className="na-card p-4 flex flex-col gap-2.5">
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
                        {dueInfo && (
                          <span
                            className={
                              "text-[11px] font-semibold " +
                              (dueInfo.tier === "overdue"
                                ? "px-2 py-0.5 rounded-full bg-red-50 text-red-600"
                                : dueInfo.tier === "today"
                                  ? "px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"
                                  : dueInfo.tier === "soon"
                                    ? "text-amber-600"
                                    : "")
                            }
                            style={dueInfo.tier === "normal" ? { color: "var(--neu-ink-faint)" } : undefined}
                          >
                            {dueInfo.label}
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
        templates={templates.map((t) => ({ id: t.id, title: t.title, description: t.description, priority: t.priority }))}
      />
    </div>
  );
}
