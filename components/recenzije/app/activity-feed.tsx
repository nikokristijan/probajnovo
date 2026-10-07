import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Mail,
  MessageCircle,
  MousePointerClick,
  Send,
  Star,
  UserPlus,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent, ActivityType } from "@/lib/recenzije/db/schema";
import { timeAgo } from "@/lib/recenzije/status";
import { cn } from "@/lib/recenzije/utils";
import { Avatar } from "@/components/recenzije/ui/primitives";

const ICONS: Record<ActivityType, { icon: LucideIcon; cls: string }> = {
  client_created: { icon: UserPlus, cls: "text-muted bg-surface-3" },
  weekly_report_sent: { icon: Mail, cls: "text-muted bg-surface-3" },
  service_completed: { icon: Wrench, cls: "text-muted bg-surface-3" },
  request_sent: { icon: Send, cls: "text-info bg-info-soft" },
  link_clicked: { icon: MousePointerClick, cls: "text-violet bg-violet-soft" },
  review_received: { icon: Star, cls: "text-white bg-orange" },
  follow_up_scheduled: { icon: CalendarClock, cls: "text-warning bg-warning-soft" },
  follow_up_sent: { icon: Send, cls: "text-warning bg-warning-soft" },
  message_failed: { icon: AlertTriangle, cls: "text-danger bg-danger-soft" },
  reply_received: { icon: MessageCircle, cls: "text-accent bg-accent-soft" },
  opt_out: { icon: Ban, cls: "text-danger bg-danger-soft" },
  automation_completed: { icon: Workflow, cls: "text-accent bg-accent-soft" },
};

export function ActivityFeed({
  items,
  linkClients = true,
  absolute = false,
  timeZone,
}: {
  items: (ActivityEvent & { clientName?: string | null })[];
  linkClients?: boolean;
  absolute?: boolean;
  timeZone?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <CheckCircle2 className="size-6 text-subtle" />
        <p className="mt-2 text-sm text-muted">Još nema aktivnosti. Pojavit će se čim dodate klijenta ili pošaljete zahtjev.</p>
      </div>
    );
  }
  return (
    <ol className="relative">
      {items.map((e, i) => {
        const meta = ICONS[e.type] ?? ICONS.client_created;
        const Icon = meta.icon;
        const body = (
          <div className="flex gap-3 py-2.5">
            <div className="relative flex flex-col items-center">
              {e.clientName ? (
                <span className="relative">
                  <Avatar name={e.clientName} className="size-8 text-[11px]" />
                  <span className={cn("absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full ring-2 ring-white", meta.cls)}>
                    <Icon className="size-[10px]" />
                  </span>
                </span>
              ) : (
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", meta.cls)}>
                  <Icon className="size-[15px]" />
                </span>
              )}
              {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1 pb-1 pt-1">
              <p className="text-sm leading-snug">{e.title}</p>
              {e.type === "message_failed" && typeof e.meta?.error === "string" && (
                <p className="mt-0.5 truncate text-xs text-danger/90">{e.meta.error}</p>
              )}
              <p className="mt-0.5 text-xs text-subtle">
                <time dateTime={new Date(e.createdAt).toISOString()} title={new Date(e.createdAt).toLocaleString("hr-HR", { timeZone: timeZone ?? "Europe/Zagreb" })}>
                  {absolute
                    ? new Date(e.createdAt).toLocaleString("hr-HR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timeZone ?? "Europe/Zagreb" })
                    : timeAgo(e.createdAt)}
                </time>
              </p>
            </div>
          </div>
        );
        return (
          <li key={e.id}>
            {linkClients && e.clientId ? (
              <Link href={`/recenzije/klijenti/${e.clientId}`} className="-mx-2 block px-2 hover:bg-surface-2">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
