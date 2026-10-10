import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import {
  automations,
  organizationMembers,
  organizations,
  passwordResetTokens,
  plans,
  subscriptions,
  users,
} from "@/lib/recenzije/db/schema";
import { AUTOMATION_TEMPLATES } from "@/lib/recenzije/automation/templates";
import { createId } from "@/lib/recenzije/id";
import { OPERATOR_EMAIL, OPERATOR_NAME } from "@/lib/recenzije/operator";
import {
  AdminError,
  clampFreeDays,
  formatAdminDate,
  freePeriodValues,
  paidPeriodValues,
} from "@/lib/recenzije/services/novo-admin";
import { slugify } from "@/lib/recenzije/utils";
import { ensureVenueAutomation } from "@/lib/recenzije/services/guests";
import { ensureVenueMenu } from "@/lib/recenzije/services/menus";

/**
 * Klijenti koje NOVO vodi kao uslugu (/admin/recenzije): otvaranje klijenta bez računa,
 * uređivanje kontakta i bilješke te ulaz u radni prostor klijenta pod internim "operater"
 * korisnikom. Pozivatelj je dužan prije toga provjeriti da je admin glavni admin.
 */

export type NewManagedClient = {
  name: string;
  industry: string | null;
  phone: string | null;
  googleReviewUrl: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  planKey: string;
  /** > 0: besplatno razdoblje; 0: plaćeni paket na `paidMonths`. */
  freeDays: number;
  paidMonths: number;
  /** Ugostiteljstvo (kafić, restoran, konoba ...): uključuje digitalni jelovnik i unos brojeva gostiju. Zadano false. */
  isVenue?: boolean;
};

/**
 * Napravi tvrtku BEZ članova (klijent nema prijavu), uključi zadanu automatizaciju
 * "zahtjev za recenziju nakon posla" (isto kao createOrganizationAction) i otvori pretplatu.
 * Sve u jednoj transakciji: ili nastane cijeli klijent ili ništa.
 */
export async function createManagedClient(input: NewManagedClient) {
  await ensureReviewsDb();
  const [plan] = await db.select().from(plans).where(eq(plans.key, input.planKey)).limit(1);
  if (!plan || !plan.active) throw new AdminError("Nepoznat paket.");

  const orgId = createId();
  const subscription =
    input.freeDays > 0
      ? freePeriodValues(plan.key, new Date(Date.now() + clampFreeDays(input.freeDays) * 86_400_000))
      : paidPeriodValues(plan.key, input.paidMonths);
  const template = AUTOMATION_TEMPLATES.find((a) => a.key === "post_service_review");
  if (!template) throw new Error("Nedostaje zadani predložak automatizacije.");

  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: orgId,
      name: input.name,
      slug: `${slugify(input.name) || "business"}-${orgId.slice(-6)}`,
      industry: input.industry,
      phone: input.phone,
      timezone: "Europe/Zagreb",
      googleReviewUrl: input.googleReviewUrl,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      isVenue: input.isVenue === true,
    });
    await tx.insert(automations).values({
      organizationId: orgId,
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      templateKey: template.key,
      enabled: true,
      steps: template.steps.map((s) => ({ ...s, id: createId() })) as never,
    });
    await tx.insert(subscriptions).values({ organizationId: orgId, ...subscription });
  });

  if (input.isVenue === true) {
    // Jelovnik i njegova automatizacija nastaju odmah (operater ih odmah vidi); ako ovdje nešto pođe po zlu,
    // nastaju pri prvom otvaranju jelovnika, pa to ne smije srušiti otvaranje klijenta.
    await ensureVenueMenu(orgId).catch((e) => console.error("[recenzije] jelovnik klijenta", e));
    await ensureVenueAutomation(orgId).catch((e) => console.error("[recenzije] automatizacija jelovnika", e));
  }

  const until = formatAdminDate(subscription.currentPeriodEnd);
  return {
    id: orgId,
    name: input.name,
    summary:
      input.freeDays > 0
        ? `${input.name}: besplatno razdoblje (${plan.name}) do ${until}`
        : `${input.name}: plaćeni paket ${plan.name} do ${until}`,
  };
}

export type ClientDetails = {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  internalNote: string | null;
  /** Vrsta poslovanja: true = ugostiteljstvo (jelovnik). Izostavljeno = ne mijenja se. */
  isVenue?: boolean;
};

/** Kontakt klijenta (na njega ide tjedni izvještaj) i interna bilješka koju vidi samo NOVO tim. */
export async function updateClientDetails(organizationId: string, details: ClientDetails) {
  await ensureReviewsDb();
  const [org] = await db
    .select({ name: organizations.name, isDemo: organizations.isDemo })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) throw new AdminError("Klijent nije pronađen.");
  if (org.isDemo) throw new AdminError("Demo se ne mijenja.");
  await db
    .update(organizations)
    .set({
      contactName: details.contactName,
      contactEmail: details.contactEmail,
      contactPhone: details.contactPhone,
      internalNote: details.internalNote,
      ...(details.isVenue === undefined ? {} : { isVenue: details.isVenue }),
    })
    .where(eq(organizations.id, organizationId));
  return org.name;
}

/**
 * Osigura da interni operater postoji i da je VLASNIK radnog prostora tog klijenta, pa vrati
 * njegov id (za createSession). Operater nema lozinku: svaki put mu se brišu lozinka, Google
 * veza i otvoreni tokeni za reset, pa se pod njim ne može prijaviti nitko osim ovim putem.
 * Demo se nikad ne otvara ovuda (ni ne dobiva člana): samo za čitanje ide zasebna radnja.
 */
export async function ensureOperatorMember(organizationId: string): Promise<string> {
  await ensureReviewsDb();
  const [org] = await db
    .select({ id: organizations.id, isDemo: organizations.isDemo })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) throw new AdminError("Klijent nije pronađen.");
  if (org.isDemo) throw new AdminError("Demo se ne otvara kao klijent.");

  return db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({ name: OPERATOR_NAME, email: OPERATOR_EMAIL, emailVerified: new Date(), passwordHash: null })
      .onConflictDoNothing({ target: users.email });
    const [op] = await tx.select().from(users).where(eq(users.email, OPERATOR_EMAIL)).limit(1);
    if (!op) throw new Error("Operater nije napravljen.");
    if (op.passwordHash || op.googleId || !op.emailVerified || op.name !== OPERATOR_NAME) {
      await tx
        .update(users)
        .set({ passwordHash: null, googleId: null, emailVerified: op.emailVerified ?? new Date(), name: OPERATOR_NAME })
        .where(eq(users.id, op.id));
    }
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, op.id));
    await tx
      .insert(organizationMembers)
      .values({ organizationId, userId: op.id, role: "OWNER" })
      .onConflictDoUpdate({
        target: [organizationMembers.organizationId, organizationMembers.userId],
        set: { role: "OWNER" },
      });
    return op.id;
  });
}
