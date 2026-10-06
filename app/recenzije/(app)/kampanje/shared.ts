import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { services } from "@/lib/recenzije/db/schema";

export async function selectDistinct(orgId: string) {
  const rows = await db.selectDistinct({ v: services.name }).from(services).where(eq(services.organizationId, orgId)).orderBy(services.name);
  return rows.map((r) => r.v);
}
