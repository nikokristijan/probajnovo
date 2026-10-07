import Link from "next/link";
import { Logo } from "@/components/recenzije/brand";
import { Button } from "@/components/recenzije/ui/button";
import { logoutAction } from "@/lib/recenzije/actions/auth";
import { requireUser } from "@/lib/recenzije/session";

export const metadata = { title: "Nema pristupa" };

/**
 * Korisnik bez ijedne tvrtke. Tvrtke više ne otvaraju korisnici sami
 * (uslugu vodi NOVO, vidi /admin/recenzije), pa ovdje samo objašnjavamo.
 */
export default async function OnboardingPage() {
  await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center border-b border-border px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-[520px] px-4 py-12 sm:px-0">
        <p className="label mb-3 flex items-center gap-2 text-muted">
          <span className="size-1.5 bg-orange" /> Pristup
        </p>
        <h1 className="text-3xl font-bold">Ovaj račun još nije povezan s tvrtkom.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          NOVO Recenzije postavlja i vodi tim NOVO. Ako želite automatske zahtjeve za Google recenzije za svoj obrt ili tvrtku,
          pošaljite nam upit i javit ćemo vam se.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/recenzije#ponuda">Zatraži ponudu</Link>
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Odjava
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
