"use client";

import { useActionState, useState } from "react";
import { updateAgencyAction, type ActionState } from "@/lib/actions";
import type { Agency } from "@/lib/db/schema";

type FormValues = {
heroTitle: string;
officeText: string;
contactEmail: string;
instagramHandle: string;
city: string;
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
return (
  <label className="flex flex-col gap-1.5">
  <span className="text-sm font-medium">{label}</span>
  {children}
</label>
  );
}
