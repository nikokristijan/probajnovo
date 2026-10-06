"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/recenzije/db";
import { organizations } from "@/lib/recenzije/db/schema";
import { type ActionState, echoValues, formObject } from "@/lib/recenzije/action";
import { encrypt } from "@/lib/recenzije/crypto";
import { requireOrg, requireRole, DEMO_LOCKED, type OrgContext } from "@/lib/recenzije/session";
import { createCheckoutSession, createPortalSession } from "@/lib/recenzije/services/billing";
import { disconnectGoogle, discoverLocation } from "@/lib/recenzije/services/google";
import { connectGateway } from "@/lib/recenzije/services/sms";

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

/** Spaja mobitel tvrtke (SMS Gateway for Android): provjerava podatke i registrira webhookove. */
export async function saveSmsGatewayAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, deny } = await admin();
  if (deny) return deny;
  const parsed = z
    .object({
      user: z.string().trim().min(3, "Upišite korisničko ime iz aplikacije").max(100),
      pass: z.string().trim().max(200).optional().default(""),
      signingKey: z.string().trim().max(200).optional().default(""),
    })
    .safeParse(formObject(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { values: echoValues(fd), fieldErrors: fe };
  }
  const d = parsed.data;
  const passEnc = d.pass ? encrypt(d.pass) : ctx.org.smsGatewayPassEnc;
  if (!passEnc) return { values: echoValues(fd), fieldErrors: { pass: "Upišite lozinku iz aplikacije" } };
  const candidate = { id: ctx.org.id, smsGatewayUser: d.user, smsGatewayPassEnc: passEnc };
  try {
    await connectGateway(candidate);
  } catch (e) {
    return { values: echoValues(fd), error: e instanceof Error ? e.message : "Povezivanje nije uspjelo" };
  }
  await db
    .update(organizations)
    .set({
      smsGatewayUser: candidate.smsGatewayUser,
      smsGatewayPassEnc: candidate.smsGatewayPassEnc,
      ...(d.signingKey ? { smsGatewaySigningKeyEnc: encrypt(d.signingKey) } : {}),
    })
    .where(eq(organizations.id, ctx.org.id));
  revalidatePath("/recenzije", "layout");
  return {
    ok: true,
    message: d.signingKey
      ? "Mobitel je povezan. Poruke idu s vašeg broja, a potvrde i odgovori stižu automatski."
      : "Mobitel je povezan. Dodajte i ključ za potpis (Signing key) da stižu potvrde isporuke i odgovori.",
  };
}

export async function removeSmsGatewayAction(): Promise<ActionState> {
  const { ctx, deny } = await admin();
  if (deny) return deny;
  await db
    .update(organizations)
    .set({ smsGatewayUser: null, smsGatewayPassEnc: null, smsGatewaySigningKeyEnc: null })
    .where(eq(organizations.id, ctx.org.id));
  revalidatePath("/recenzije", "layout");
  return { ok: true, message: "Mobitel je odspojen" };
}

export async function checkoutAction(planKey: string) {
  const { ctx, deny } = await admin();
  if (deny) redirect(`/recenzije/postavke/pretplata?error=${encodeURIComponent(deny.error ?? "")}`);
  const key = z.string().min(1).max(40).parse(planKey);
  let url: string;
  try {
    url = await createCheckoutSession({ organizationId: ctx.org.id, planKey: key, email: ctx.user.email });
  } catch (e) {
    redirect(`/recenzije/postavke/pretplata?error=${encodeURIComponent(e instanceof Error ? e.message : "Plaćanje nije uspjelo")}`);
  }
  redirect(url);
}

export async function portalAction() {
  const { ctx, deny } = await admin();
  if (deny) redirect(`/recenzije/postavke/pretplata?error=${encodeURIComponent(deny.error ?? "")}`);
  let url: string;
  try {
    url = await createPortalSession(ctx.org.id);
  } catch (e) {
    redirect(`/recenzije/postavke/pretplata?error=${encodeURIComponent(e instanceof Error ? e.message : "Portal za naplatu nije dostupan")}`);
  }
  redirect(url);
}
