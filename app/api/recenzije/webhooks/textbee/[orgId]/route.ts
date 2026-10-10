import { handleTextbeeWebhook } from "@/lib/recenzije/services/textbee-webhook";
import { resolveOrgWebhook } from "@/lib/recenzije/services/org-textbee";

/**
 * Webhook TextBeea za mobitel JEDNE tvrtke: potpis se provjerava tajnom te tvrtke (nr_organizations.textbee_webhook_secret_enc), a
 * odgovori i potvrde isporuke vežu se samo uz tu tvrtku. Nepoznata tvrtka, tvrtka bez tajne i loš potpis daju ISTI odgovor (403), pa se
 * adresom ne može saznati koje tvrtke postoje. Obrada je ista kao na zajedničkoj adresi (services/textbee-webhook.ts).
 */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  let org: Awaited<ReturnType<typeof resolveOrgWebhook>> = null;
  try {
    org = await resolveOrgWebhook(orgId);
  } catch (e) {
    console.error("[recenzije] TextBee webhook tvrtke", e instanceof Error ? e.name : typeof e);
    return Response.json({ ok: false }, { status: 500 });
  }
  return handleTextbeeWebhook(req, { kind: "org", org });
}
