"use server";

import { z } from "zod";
import { createInquiryAction } from "@/lib/actions";
import { type ActionState, echoValues, formObject, zodErrors } from "@/lib/recenzije/action";
import { annualPriceEur, findHospitalityPlan, formatEur } from "@/lib/hospitality-plans";

/** Naziv u /admin/inquiries (stupac "izvor") i u potvrdi koju dobiva podnositelj. */
const SOURCE_NAME = "NOVO Digitalni jelovnik";

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
    .min(2, "Upišite naziv lokala")
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
 * Javni upit za digitalni jelovnik. Ne piše u bazu sam: slaže poruku i poziva isti createInquiryAction kao i obrasci na
 * /proizvodi i /recenzije, pa upit završi u /admin/inquiries, vlasnik dobije email i push obavijest, a podnositelj
 * potvrdu, uz isti limit po IP-u. Paket se provjerava prema lib/hospitality-plans.ts (ne vjerujemo tekstu iz preglednika).
 */
export async function digitalniJelovnikInquiryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };
  const d = parsed.data;
  if (d.website) return { ok: true }; // bot: tvorimo se da je poslano, ništa ne spremamo

  const plan = findHospitalityPlan(d.plan);
  const planLine = plan
    ? `Paket: ${plan.name} (${formatEur(plan.priceMonthlyEur)} / mj bez PDV-a; godišnje ${formatEur(annualPriceEur(plan.priceMonthlyEur))})`
    : "Paket: još ne znam";

  const message = [
    "Usluga: Digitalni jelovnik za kafiće i restorane (mi vodimo cijelu uslugu za lokal)",
    `Lokal: ${d.business}`,
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
