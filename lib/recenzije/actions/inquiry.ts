"use server";

import { z } from "zod";
import { createInquiryAction } from "@/lib/actions";
import { type ActionState, echoValues, formObject, zodErrors } from "@/lib/recenzije/action";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { formatEur } from "@/lib/recenzije/status";
import { listPlans } from "@/lib/recenzije/services/billing";

/** Naziv u /admin/inquiries (stupac "izvor") i u potvrdi koju dobiva podnositelj. */
const SOURCE_NAME = "NOVO Recenzije";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Upišite ime i prezime")
    .max(200)
    .transform((v) => v.replace(/\s+/g, " ")),
  email: z.string().trim().toLowerCase().email("Upišite ispravnu email adresu").max(200),
  phone: z.string().trim().max(40).default(""),
  business: z
    .string()
    .trim()
    .min(2, "Upišite naziv tvrtke")
    .max(160)
    .transform((v) => v.replace(/\s+/g, " ")),
  plan: z.string().trim().max(40).default(""),
  note: z.string().trim().max(2000).default(""),
  consent: z.literal("on", { error: "Potvrdite da se slažete s obradom podataka" }),
  // Honeypot: ljudi ga ne vide, botovi ga često ispune.
  website: z.string().max(200).default(""),
  attribution: z.string().max(300).default(""),
  pageUrl: z.string().max(300).default(""),
});

/**
 * Javni upit za NOVO Recenzije. Ne piše u bazu sam: slaže poruku i poziva isti
 * createInquiryAction kao i obrasci na /proizvodi, pa upit završi u /admin/inquiries,
 * vlasnik dobije email i push obavijest, a podnositelj potvrdu, uz isti limit po IP-u.
 */
export async function recenzijeInquiryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };
  const d = parsed.data;
  if (d.website) return { ok: true }; // bot: tvorimo se da je poslano, ništa ne spremamo

  // Paket provjeravamo prema bazi (ne vjerujemo tekstu iz preglednika); ako baza zapne, upit se svejedno šalje.
  let planLine = "Paket: još ne znam";
  if (d.plan) {
    try {
      await ensureReviewsDb();
      const plan = (await listPlans()).find((p) => p.key === d.plan);
      if (plan) planLine = `Paket: ${plan.name} (${formatEur(plan.priceMonthlyCents)} / mj bez PDV-a)`;
    } catch (e) {
      console.error("[recenzije] upit: paket nije učitan", e);
    }
  }

  const message = [
    "Usluga: NOVO Recenzije (mi vodimo cijelu uslugu za klijenta)",
    `Tvrtka: ${d.business}`,
    planLine,
    d.note ? `\n${d.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const out = new FormData();
  out.set("source", "agency");
  out.set("sourceName", SOURCE_NAME);
  out.set("name", d.name);
  out.set("email", d.email);
  out.set("phone", d.phone);
  out.set("message", message);
  out.set("attribution", d.attribution);
  out.set("pageUrl", d.pageUrl);

  const res = await createInquiryAction(undefined, out);
  if (res?.success) return { ok: true };
  return { values: echoValues(fd), error: res?.error ?? "Slanje nije uspjelo. Pokušajte ponovno ili nam se javite emailom." };
}
