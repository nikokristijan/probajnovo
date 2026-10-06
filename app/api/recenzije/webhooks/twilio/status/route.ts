import { applyDeliveryStatus } from "@/lib/recenzije/services/inbound";
import { mapTwilioStatus } from "@/lib/recenzije/services/sms";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { readTwilio } from "../../_shared";

/** Twilio status isporuke: queued → sent → delivered / failed / undelivered. */
export async function POST(req: Request) {
  const { ok, params } = await readTwilio(req, "/api/recenzije/webhooks/twilio/status");
  if (!ok) return new Response("Invalid signature", { status: 403 });
  const status = mapTwilioStatus(params.MessageStatus || "");
  if (!params.MessageSid || status === "QUEUED") return new Response(null, { status: 204 });
  await ensureReviewsDb();
  await applyDeliveryStatus(
    params.MessageSid,
    status,
    `Twilio ${params.ErrorCode ?? ""}${params.ErrorMessage ? `: ${params.ErrorMessage}` : ""}`.trim()
  );
  return new Response(null, { status: 204 });
}
