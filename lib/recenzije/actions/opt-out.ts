"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { OPT_OUT_TOKEN, optOutByToken } from "@/lib/recenzije/services/opt-out";

/**
 * Javna radnja sa stranice /o/<token>: odjava klijenta s SMS poruka. Poziva se samo POST-om (gumb u formi),
 * nikad GET-om, jer skeneri poveznica u porukama i mailu otvaraju poveznice unaprijed. Ograničena brojem
 * zahtjeva, idempotentna i ne otkriva postoji li klijent: nepoznat token vodi na istu stranicu kao istekao.
 */
export async function optOutAction(formData: FormData): Promise<void> {
  const raw = formData.get("token");
  const parsed = z.string().regex(OPT_OUT_TOKEN).safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) redirect("/o/-");
  const token = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const byIp = rateLimit(`o:act:${ip}`, 10, 60_000);
  const byToken = rateLimit(`o:tok:${token}`, 10, 60_000);
  if (!byIp.ok || !byToken.ok) redirect(`/o/${token}?greska=limit`);

  let outcome: "done" | "invalid" | "error";
  try {
    await ensureReviewsDb();
    outcome = (await optOutByToken(token)).ok ? "done" : "invalid";
  } catch (e) {
    console.error("[recenzije] odjava poveznicom", e instanceof Error ? e.name : typeof e);
    outcome = "error";
  }

  if (outcome === "done") redirect(`/o/${token}?gotovo=1`);
  if (outcome === "error") redirect(`/o/${token}?greska=1`);
  redirect(`/o/${token}`);
}
