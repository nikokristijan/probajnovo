import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { handleSharedPhoneInbound } from "@/lib/recenzije/services/inbound";
import { readTwilio, twiml } from "../../_shared";

/**
 * Dolazni SMS na Twilio pošiljatelj (zajednički za sve tvrtke). U Hrvatskoj Twilio ne podržava dvosmjerni SMS,
 * pa ovdje stižu samo odgovori s mreža koje to dopuštaju. STOP odjavljuje broj u svim tvrtkama (kao kod
 * zajedničkog NOVO mobitela); odgovor se pripisuje tvrtki koja je tom broju zadnja poslala preko Twilija.
 */
export async function POST(req: Request) {
  const { ok, params } = await readTwilio(req, "/api/recenzije/webhooks/twilio/inbound");
  if (!ok) return new Response("Invalid signature", { status: 403 });
  if (!params.From) return twiml();
  await ensureReviewsDb();
  await handleSharedPhoneInbound({
    from: params.From,
    to: params.To || "",
    body: params.Body || "",
    providerSid: params.MessageSid,
    channel: "twilio",
  });
  return twiml();
}
