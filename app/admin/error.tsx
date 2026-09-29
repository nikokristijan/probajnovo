"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Zaštitna mreža za CIJELI /admin (uključujući Portal) — na izričit zahtjev
 * nakon prijave "stranica se srušila kad sam probao završiti zadatak".
 * Bez ovog error.tsx-a, Next.js za bilo koju neuhvaćenu grešku u bilo kojoj
 * admin/Portal komponenti (npr. TasksBoard, TeamStats, OfficePresence) u
 * produkciji prikazuje generičan prazan/bijeli "Application error" ekran
 * bez ikakve poruke ili načina oporavka — korisniku to izgleda kao da se
 * "cijela stranica srušila". Ovaj boundary hvata takve greške ODMAH ISPOD
 * navigacije (app/admin/layout.tsx ostaje vidljiv i klikabilan — nav/izbornik
 * se NE gasi), prikazuje razumljivu poruku na hrvatskom i nudi dva izlaza:
 * "Pokušaj ponovno" (reset() — samo ponovno renderira srušeni dio, bez
 * gubitka route-a) i link natrag na Pregled ako reset ne pomogne.
 *
 * Greška se samo logira u konzolu (za dev/debug) — NE šalje se nigdje
 * vanjski, ovaj projekt nema Sentry/error-tracking postavljen.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin/Portal greška:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-16">
      <div className="neu-card p-6 max-w-md w-full flex flex-col items-center gap-3 text-center">
        <span className="text-3xl" aria-hidden="true">
          ⚠️
        </span>
        <h2 className="text-base font-semibold">Nešto je pošlo po zlu.</h2>
        <p className="text-sm" style={{ color: "var(--neu-ink-faint)" }}>
          Ova stranica je naišla na grešku i nije se mogla prikazati. Podaci nisu izgubljeni — probaj ponovno, ili se vrati na Pregled ako se greška ponavlja.
        </p>
        <div className="flex items-center gap-2 mt-1">
          <button type="button" onClick={() => reset()} className="neu-btn px-4 py-2 text-sm font-semibold">
            Pokušaj ponovno
          </button>
          <Link href="/admin" className="admin-quicklink !py-2 !px-4 !text-sm">
            Natrag na Pregled
          </Link>
        </div>
        {error.digest && (
          <p className="text-[10px] mt-1" style={{ color: "var(--neu-ink-faint)" }}>
            Kod greške: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
