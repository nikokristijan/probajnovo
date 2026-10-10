"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/recenzije/db";
import { organizations } from "@/lib/recenzije/db/schema";
import { type ActionState } from "@/lib/recenzije/action";
import { requireOrg, requireRole, DEMO_LOCKED, type OrgContext } from "@/lib/recenzije/session";
import { disconnectGoogle, discoverLocation } from "@/lib/recenzije/services/google";
import { smsProvider } from "@/lib/recenzije/services/sms";

/** Vlasnik ili admin, i nikad demo. */
async function admin(): Promise<{ ctx: OrgContext; deny: ActionState | null }> {
  const ctx = await requireOrg();
  if (ctx.org.isDemo) return { ctx, deny: DEMO_LOCKED };
  try {
    requireRole(ctx, ["OWNER", "ADMIN"]);
  } catch (e) {
    return { ctx, deny: { error: (e as Error).message } };
  }
  return { ctx, deny: null };
}

export async function disconnectGoogleAction(): Promise<ActionState> {
  const { ctx, deny } = await admin();
  if (deny) return deny;
  await disconnectGoogle(ctx.org.id);
  revalidatePath("/recenzije/postavke");
  return { ok: true, message: "Google je odspojen. Link za recenzije ostaje spremljen." };
}

export async function refreshGoogleLocationAction(): Promise<ActionState> {
  const { ctx, deny } = await admin();
  if (deny) return deny;
  try {
    await discoverLocation(ctx.org.id);
    revalidatePath("/recenzije/postavke");
    return { ok: true, message: "Lokacija tvrtke osvježena" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Google zahtjev nije uspio" };
  }
}

/**
 * Stari način: tvrtka je imala vlastiti mobitel (SMS Gateway). Sada sve poruke šalje zajednički NOVO
 * pošiljatelj (Twilio, TextBee ili NOVO mobitel), pa se ovdje samo uklanja ostatak stare veze.
 */
export async function removeSmsGatewayAction(): Promise<ActionState> {
  const { ctx, deny } = await admin();
  if (deny) return deny;
  // Bez zajedničkog pošiljatelja (ili vlastitog TextBee mobitela tvrtke) odspajanje starog ostavilo bi tvrtku bez ikakvog slanja.
  if (smsProvider({ ...ctx.org, smsGatewayUser: null, smsGatewayPassEnc: null }) === null) return { error: "NOVO SMS pošiljatelj još nije postavljen, pa se stari mobitel zasad ne odspaja. Javite se NOVO-u." };
  await db
    .update(organizations)
    .set({ smsGatewayUser: null, smsGatewayPassEnc: null, smsGatewaySigningKeyEnc: null })
    .where(eq(organizations.id, ctx.org.id));
  revalidatePath("/recenzije", "layout");
  return { ok: true, message: "Stari mobitel je odspojen. SMS se od sada šalju s NOVO pošiljatelja." };
}
