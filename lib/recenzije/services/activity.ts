import "server-only";
import { db } from "@/lib/recenzije/db";
import { activityEvents, type ActivityType } from "@/lib/recenzije/db/schema";

export async function logActivity(input: {
  organizationId: string;
  clientId?: string | null;
  type: ActivityType;
  title: string;
  meta?: Record<string, unknown>;
  at?: Date;
}) {
  await db.insert(activityEvents).values({
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    type: input.type,
    title: input.title,
    meta: input.meta ?? null,
    ...(input.at ? { createdAt: input.at } : {}),
  });
}
