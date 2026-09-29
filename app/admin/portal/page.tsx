import { Suspense } from "react";
import { requireFullAdmin } from "@/lib/auth";
import {
  listTeamMessagesWithReactions,
  listTeamTasks,
  listTeamMembers,
  listProperties,
  listCompanies,
  getTeamMessageCountsByDay,
  getTeamTaskStatusCounts,
  getTeamTaskCompletionByAdmin,
} from "@/lib/db/queries";
import PortalMain from "@/components/admin/PortalMain";
import TeamChannelThread from "@/components/admin/TeamChannelThread";
import TasksBoard from "@/components/admin/TasksBoard";
import TeamStats from "@/components/admin/TeamStats";

/**
 * Portal hub (Faza 3) — spojeni Zadaci+Poruke tab ("Zadaci i poruke nek
 * budu u jednom tabu, 'Portal'"), plus nova Statistika sekcija. Sve tri
 * "slot" komponente (kanal/zadaci/statistika) renderiraju se ovdje na
 * serveru i prosljeđuju PortalMain.tsx klijentskoj komponenti koja samo
 * bira koja je vidljiva preko ?tab= — bez punog reloada pri prebacivanju.
 */
export default async function PortalPage() {
  const admin = await requireFullAdmin();

  const [messages, tasks, teamMembers, properties, companies, messageCounts, statusCounts, completionByAdmin] =
    await Promise.all([
      listTeamMessagesWithReactions(admin.email, 200),
      listTeamTasks(),
      listTeamMembers(),
      listProperties(),
      listCompanies(),
      getTeamMessageCountsByDay(7),
      getTeamTaskStatusCounts(),
      getTeamTaskCompletionByAdmin(),
    ]);

  const roster = teamMembers.map((m) => ({ email: m.email, displayName: m.displayName ?? null }));

  return (
    // useSearchParams() unutar PortalMain (za ?tab=) treba Suspense granicu,
    // vidi identičan komentar uz PortalSidebar u app/admin/portal/layout.tsx.
    <Suspense fallback={null}>
    <PortalMain
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
      tasksSlot={<TasksBoard tasks={tasks} teamMembers={teamMembers.map((m) => ({ email: m.email }))} properties={properties} companies={companies} />}
      statsSlot={<TeamStats messageCounts={messageCounts} statusCounts={statusCounts} completionByAdmin={completionByAdmin} roster={roster} />}
    />
    </Suspense>
  );
}
