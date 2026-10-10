import { env } from "@/lib/recenzije/env";
import { handleTextbeeWebhook } from "@/lib/recenzije/services/textbee-webhook";

/**
 * Webhook TextBeea (textbee.dev) za ZAJEDNIČKI mobitel s vlastitim brojem. Adresa se upisuje u TextBee nadzornoj ploči
 * (Webhooks), a tajna koju ondje upišete mora biti ISTA kao TEXTBEE_WEBHOOK_SECRET. Bez tajne 503, bez ispravnog potpisa 403.
 * Mobitel pojedine tvrtke ima svoju adresu: ./[orgId]/route.ts. Sva obrada je u services/textbee-webhook.ts.
 */
export async function POST(req: Request) {
  return handleTextbeeWebhook(req, { kind: "shared", secret: env.textbeeWebhookSecret });
}
