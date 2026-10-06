import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { organizationMembers, organizations, users, type Organization } from "@/lib/recenzije/db/schema";
import { sessionUserId } from "@/lib/recenzije/auth";
import type { ActionState } from "@/lib/recenzije/action";

export const ACTIVE_ORG_COOKIE = "nr_org";

export const getCurrentUser = cache(async () => {
  await ensureReviewsDb();
  const uid = await sessionUserId();
  if (!uid) return null;
  const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  return user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/recenzije/prijava");
  return user;
}

export type OrgContext = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  org: Organization;
  role: "OWNER" | "ADMIN" | "MEMBER";
  memberships: { id: string; name: string; role: string }[];
};

/**
 * Aktivna tvrtka korisnika. Kolačić samo BIRA između tvrtki čiji je korisnik
 * član — nikad sam ne daje pristup. Svaki upit nad podacima koristi ctx.org.id.
 */
export const requireOrg = cache(async (): Promise<OrgContext> => {
  const user = await requireUser();
  const rows = await db
    .select({ org: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, user.id))
    .orderBy(asc(organizationMembers.createdAt));

  if (rows.length === 0) redirect("/recenzije/postavljanje");

  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = rows.find((r) => r.org.id === wanted) ?? rows[0];
  return {
    user,
    org: active.org,
    role: active.role,
    memberships: rows.map((r) => ({ id: r.org.id, name: r.org.name, role: r.role })),
  };
});

export async function getOrgForApi(): Promise<OrgContext | null> {
  if (!(await sessionUserId())) return null;
  try {
    return await requireOrg();
  } catch {
    return null;
  }
}

export async function assertMember(userId: string, organizationId: string) {
  const [m] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
    .limit(1);
  return Boolean(m);
}

export function requireRole(ctx: OrgContext, roles: OrgContext["role"][]) {
  if (!roles.includes(ctx.role)) throw new Error("Nemate ovlasti za tu radnju.");
}

export const DEMO_LOCKED: ActionState = {
  error: "Ovo je demo za razgledavanje, izmjene su isključene. Napravite svoj besplatni račun da sve isprobate.",
};

/** Za akcije koje mijenjaju podatke: demo radni prostor je samo za čitanje. */
export async function requireWritableOrg(): Promise<{ ctx: OrgContext; locked: ActionState | null }> {
  const ctx = await requireOrg();
  return { ctx, locked: ctx.org.isDemo ? DEMO_LOCKED : null };
}
