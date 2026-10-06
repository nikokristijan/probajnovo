import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { handleInboundSms } from "@/lib/recenzije/services/inbound";
import { readTwilio, twiml } from "../../_shared";

/** Dolazni SMS na Twilio broj. STOP odjavljuje klijenta. */
export async function POST(req: Request) {
  const { ok, params } = await readTwilio(req, "/api/recenzije/webhooks/twilio/inbound");
  if (!ok) return new Response("Invalid signature", { status: 403 });
  if (!params.From) return twiml();
  await ensureReviewsDb();
  await handleInboundSms({ from: params.From, to: params.To || "", body: params.Body || "", providerSid: params.MessageSid });
  return twiml();
}
