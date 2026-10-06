import "server-only";
import { db } from "@/lib/recenzije/db";
import { automations, organizationMembers, organizations } from "@/lib/recenzije/db/schema";
import { AUTOMATION_TEMPLATES } from "@/lib/recenzije/automation/templates";
import { createId } from "@/lib/recenzije/id";
import { slugify } from "@/lib/recenzije/utils";

export type NewOrganization = {
  name: string;
  industry?: string | null;
  phone?: string | null;
  timezone?: string | null;
  googleReviewUrl?: string | null;
  /** Korisnik koji postaje vlasnik (OWNER) tvrtke. */
  ownerUserId: string;
};

/**
 * Nova tvrtka s uključenom osnovnom automatizacijom (zahtjev za recenziju
 * nakon usluge + jedan podsjetnik). Pretplatu/probu postavlja pozivatelj.
 */
export async function createOrganizationRecord(input: NewOrganization): Promise<string> {
  const orgId = createId();
  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: orgId,
      name: input.name,
      slug: `${slugify(input.name) || "business"}-${orgId.slice(-6)}`,
      industry: input.industry || null,
      phone: input.phone || null,
      timezone: input.timezone || "Europe/Zagreb",
      googleReviewUrl: input.googleReviewUrl || null,
    });
    await tx.insert(organizationMembers).values({ organizationId: orgId, userId: input.ownerUserId, role: "OWNER" });
    const t = AUTOMATION_TEMPLATES.find((a) => a.key === "post_service_review")!;
    await tx.insert(automations).values({
      organizationId: orgId,
      name: t.name,
      description: t.description,
      trigger: t.trigger,
      templateKey: t.key,
      enabled: true,
      steps: t.steps.map((s) => ({ ...s, id: createId() })) as never,
    });
  });
  return orgId;
}
