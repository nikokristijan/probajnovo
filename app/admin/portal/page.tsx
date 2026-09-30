import { requireFullAdmin } from "@/lib/auth";
import {
  listTeamMessagesWithReactions,
  listTeamTasks,
  listCommentsForTasks,
  listTaskTemplates,
  listTeamMembers,
  listProperties,
  listCompanies,
  getTeamMessageCountsByDay,
  getTeamTaskStatusCounts,
  getTeamTaskCompletionByAdmin,
  listUpcomingReservations,
  listRecentActivity,
} from "@/lib/db/queries";
import { daysUntilNextBirthdayZagreb } from "@/lib/date";
import PortalOverview from "@/components/admin/PortalOverview";
import TeamChannelThread from "@/components/admin/TeamChannelThread";
import TasksBoard from "@/components/admin/TasksBoard";
import TeamStats from "@/components/admin/TeamStats";

/**
 * Portal hub — NOVO/Revolut redizajn ("jedan veliki pregled"): umjesto
 * ranijeg tabova iza ?tab= (PortalMain), sve slotovi (kanal/zadaci/
 * statistika) se renderiraju ovdje na SERVERU i prosljeđuju
 * PortalOverview.tsx klijentskoj komponenti koja ih SVE prikazuje odjednom
 * na jednoj stranici, uz nove widgete (Task #24: pretraga, brze poveznice,
 * nadolazeće rezervacije, rođendani, aktivnost) — vidi opsežan komentar u
 * app/admin/portal/layout.tsx za cijeli kontekst redizajna.
 */
export default async function PortalPage() {
  const admin = await requireFullAdmin();

  const [
    messages,
    tasks,
    taskTemplates,
    teamMembers,
    properties,
    companies,
    messageCounts,
    statusCounts,
    completionByAdmin,
    upcomingReservations,
    recentActivity,
  ] = await Promise.all([
    listTeamMessagesWithReactions(admin.email, 200),
    listTeamTasks(),
    listTaskTemplates(),
    listTeamMembers(),
    listProperties(),
    listCompanies(),
    getTeamMessageCountsByDay(7),
    getTeamTaskStatusCounts(),
    getTeamTaskCompletionByAdmin(),
    listUpcomingReservations(6),
    listRecentActivity(6),
  ]);

  const roster = teamMembers.map((m) => ({ email: m.email, displayName: m.displayName ?? null }));
  // Plan #63: komentari na zadacima (backend je postojao, sučelja nije bilo).
  const taskComments = await listCommentsForTasks(tasks.map((t) => t.id)).catch(() => []);
  const commentsByTask: Record<number, { id: number; author: string; body: string; createdAt: string }[]> = {};
  for (const c of taskComments) {
    if (c.taskId == null) continue;
    (commentsByTask[c.taskId] ??= []).push({
      id: c.id,
      author: roster.find((r) => r.email === c.adminEmail)?.displayName?.trim() || c.adminEmail.split("@")[0],
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    });
  }
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));

  // Rođendani (Task #24) — filtrira članove tima bez postavljenog rođendana,
  // računa dane do sljedećeg nastupanja i uzima 6 najbližih. Vidi komentar
  // uz adminUsers.birthday u schema.ts (namjerno bez godine).
  const birthdays = teamMembers
    .filter((m) => m.birthday)
    .map((m) => ({
      email: m.email,
      label: m.displayName?.trim() || m.email.split("@")[0],
      birthday: m.birthday as string,
      daysUntil: daysUntilNextBirthdayZagreb(m.birthday as string),
    }))
    .filter((b): b is typeof b & { daysUntil: number } => b.daysUntil !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 6);

  return (
    <PortalOverview
      currentEmail={admin.email}
      properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      roster={roster}
      messageCounts={messageCounts}
      statusCounts={statusCounts}
      upcomingReservations={upcomingReservations}
      recentActivity={recentActivity.map((e) => ({
        id: e.id,
        adminEmail: e.adminEmail,
        action: e.action,
        targetLabel: e.targetLabel,
        propertyName: e.propertyId != null ? (propertyNameById.get(e.propertyId) ?? null) : null,
        createdAt: e.createdAt.toISOString(),
      }))}
      birthdays={birthdays}
      channelSlot={
        <TeamChannelThread
          currentEmail={admin.email}
          roster={roster}
          initialMessages={messages.map((m) => ({
            id: m.id,
            adminEmail: m.adminEmail,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
            pinnedAt: m.pinnedAt ? m.pinnedAt.toISOString() : null,
            pinnedByEmail: m.pinnedByEmail,
            reactions: m.reactions,
          }))}
        />
      }
      tasksSlot={
        <TasksBoard
          tasks={tasks}
          teamMembers={teamMembers.map((m) => ({ email: m.email }))}
          properties={properties}
          companies={companies}
          templates={taskTemplates}
          commentsByTask={commentsByTask}
        />
      }
      statsSlot={<TeamStats messageCounts={messageCounts} statusCounts={statusCounts} completionByAdmin={completionByAdmin} roster={roster} />}
    />
  );
}
