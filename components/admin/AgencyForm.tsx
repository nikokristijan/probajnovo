"use client";

import { useActionState, useState } from "react";
import { updateAgencyAction, type ActionState } from "@/lib/actions";
import type { Agency } from "@/lib/db/schema";
import { Field } from "./Field";

type FormValues = {
heroTitle: string;
officeText: string;
contactEmail: string;
instagramHandle: string;
city: string;
phone: string;
metaPixelId: string;
gaMeasurementId: string;
deliveryText: string;
productionText: string;
guaranteeText: string;
};

export default function AgencyForm({ agency }: { agency: Agency }) {
const [state, action, pending] = useActionState<ActionState, FormData>(
updateAgencyAction,
undefined
);
const [values, setValues] = useState<FormValues>({
heroTitle: agency.heroTitle,
  officeText: agency.officeText,
  contactEmail: agency.contactEmail,
  instagramHandle: agency.instagramHandle,
  city: agency.city,
  phone: agency.phone ?? "",
  metaPixelId: agency.metaPixelId ?? "",
  gaMeasurementId: agency.gaMeasurementId ?? "",
  deliveryText: agency.deliveryText ?? "",
  productionText: agency.productionText ?? "",
  guaranteeText: agency.guaranteeText ?? "",
  });

function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
setValues((v) => ({ ...v, [key]: value }));
}

return (
  <form action={action} className="flex flex-col gap-5">
  <Field label="Naslov na naslovnici (hero)">
  <textarea
  name="heroTitle"
  value={values.heroTitle}
onChange={(e) => set("heroTitle", e.target.value)}
  required
rows={3}
className="admin-input"
  />
  </Field>
  <Field label="Tekst u OFFICE sekciji">
  <textarea
  name="officeText"
  value={values.officeText}
onChange={(e) => set("officeText", e.target.value)}
  required
rows={4}
className="admin-input"
  />
  </Field>
  <Field label="Email za kontakt">
  <input
  name="contactEmail"
  type="email"
  value={values.contactEmail}
onChange={(e) => set("contactEmail", e.target.value)}
  required
className="admin-input"
/>
</Field>
<Field label="Instagram (npr. @novo.hr)">
  <input
  name="instagramHandle"
  value={values.instagramHandle}
onChange={(e) => set("instagramHandle", e.target.value)}
  required
className="admin-input"
/>
</Field>
<Field label="Grad / lokacija">
  <input
  name="city"
  value={values.city}
onChange={(e) => set("city", e.target.value)}
  required
className="admin-input"
/>
</Field>

<Field label="Telefon / WhatsApp (opcionalno — npr. +385 91 234 5678)">
  <input
  name="phone"
  type="tel"
  value={values.phone}
onChange={(e) => set("phone", e.target.value)}
  placeholder="+385 …"
className="admin-input"
/>
</Field>
<p className="text-xs text-black/50 -mt-3">
  Kad je upisan, stranice proizvoda dobiju gumbe &bdquo;Pitajte na WhatsAppu&ldquo; i &bdquo;Nazovite&ldquo;. Prazno = gumbi se ne prikazuju.
</p>

<div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
  <p className="text-sm font-semibold">Uz cijenu proizvoda: dostava, izrada, jamstvo</p>
  <p className="text-xs text-black/50">
    Kratko i konkretno — prikazuje se ispod gumba &bdquo;Zatraži ponudu&ldquo; na svakom proizvodu. Prazno polje = redak se ne prikazuje.
  </p>
  <Field label="Dostava (npr. BOX NOW paketomat ili GLS na adresu · 3,50 €)">
    <input
    name="deliveryText"
    maxLength={200}
    value={values.deliveryText}
  onChange={(e) => set("deliveryText", e.target.value)}
  className="admin-input"
  />
  </Field>
  <Field label="Rok izrade (npr. 2–4 radna dana od potvrde)">
    <input
    name="productionText"
    maxLength={200}
    value={values.productionText}
  onChange={(e) => set("productionText", e.target.value)}
  className="admin-input"
  />
  </Field>
  <Field label="Jamstvo (npr. Ne radi? Šaljemo novu pločicu besplatno)">
    <input
    name="guaranteeText"
    maxLength={200}
    value={values.guaranteeText}
  onChange={(e) => set("guaranteeText", e.target.value)}
  className="admin-input"
  />
  </Field>
</div>

<div className="border border-black/10 rounded-xl p-4 flex flex-col gap-4 bg-black/[0.02]">
  <p className="text-sm font-semibold">Mjerenje oglasa</p>
  <p className="text-xs text-black/50">
    Skripte se učitavaju tek kad posjetitelj na baneru prihvati kolačiće (GDPR). Dok su oba polja prazna, baner se ne prikazuje.
    Bilježe se pregled stranice, pregled proizvoda, odabir količine, klik na WhatsApp i poslan upit (Lead).
  </p>
  <Field label="Meta Pixel ID (Events Manager → Data sources → Pixel ID)">
    <input
    name="metaPixelId"
    inputMode="numeric"
    value={values.metaPixelId}
  onChange={(e) => set("metaPixelId", e.target.value)}
    placeholder="npr. 1234567890123456"
  className="admin-input"
  />
  </Field>
  <Field label="Google Analytics 4 ID (opcionalno)">
    <input
    name="gaMeasurementId"
    value={values.gaMeasurementId}
  onChange={(e) => set("gaMeasurementId", e.target.value)}
    placeholder="G-XXXXXXXXXX"
  className="admin-input"
  />
  </Field>
</div>

{state?.error && <p className="text-sm text-red-600">{state.error}</p>}
{state?.success && <p className="text-sm text-green-700">Spremljeno.</p>}

  <button
  type="submit"
  disabled={pending}
className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
  >
  {pending ? "Spremanje…" : "Spremi izmjene"}
</button>
  </form>
  );
}
