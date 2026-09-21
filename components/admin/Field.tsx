import type React from "react";

/**
 * Zajednički label+input wrapper za admin forme. Prije je identičan JSX bio
 * kopiran u 6 formi (CompanyForm, PropertyForm, NfcTagForm, ProductForm,
 * StudyForm, AgencyForm — ukupno ~2400 linija) — izdvojeno ovdje da buduća
 * izmjena (npr. stil greške) ne mora ručno na 6 mjesta.
 */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export default Field;
