"use client";

import { useState } from "react";

/**
 * Rezultat pozivnice (plan #13): je li e-mail otišao i link za kopiranje —
 * superadmin ga može poslati i porukom ako e-mail ne stigne.
 */
export default function InviteResult({
  email,
  link,
  emailed,
}: {
  email?: string;
  link: string;
  emailed?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="invite-result" role="status">
      <p className="text-sm font-semibold">
        {emailed ? `Pozivnica je poslana na ${email}.` : `Račun za ${email} je spreman.`}
      </p>
      <p className="text-xs mt-1 text-black/70">
        {emailed
          ? "Ako ne stigne u par minuta (provjeri i neželjenu poštu), pošalji ovaj link porukom:"
          : "E-mail nije poslan (slanje e-maila nije povezano). Pošalji ovaj link osobi porukom:"}
      </p>
      <div className="flex items-center gap-2 mt-2">
        <input
          readOnly
          value={link}
          aria-label="Link pozivnice"
          className="admin-input text-xs flex-1 min-w-0"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="rounded-full bg-black text-white text-xs font-semibold px-3.5 py-2 shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* korisnik može ručno označiti polje */
            }
          }}
        >
          {copied ? "Kopirano" : "Kopiraj link"}
        </button>
      </div>
      <p className="text-[11px] mt-1.5 text-black/55">Link vrijedi 7 dana i radi samo jednom.</p>
    </div>
  );
}
