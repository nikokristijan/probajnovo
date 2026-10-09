import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { optOutAction } from "@/lib/recenzije/actions/opt-out";
import { env } from "@/lib/recenzije/env";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { lookupOptOut } from "@/lib/recenzije/services/opt-out";

export const dynamic = "force-dynamic";

/** Poveznica iz SMS-a: ne indeksira se i ne otkriva token u Referer zaglavlju. */
export const metadata: Metadata = {
  title: "Odjava s poruka",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const mono = { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" } as const;

function Shell({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-black" style={{ fontFamily: "var(--font-space-grotesk), Arial, sans-serif" }}>
      <header className="flex h-16 items-center border-b border-[#e6e6e6] px-4 sm:px-6">
        <Image src="/novo-logo.png" alt="NOVO" width={1474} height={497} className="h-[22px] w-auto" priority />
      </header>
      <main className="mx-auto w-full max-w-[460px] flex-1 px-4 py-12 sm:px-0 sm:py-16">
        <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#6b6b6b]" style={mono}>
          <span className="size-1.5 bg-[#ff7f00]" aria-hidden /> {kicker}
        </p>
        <h1 className="text-[28px] font-bold leading-tight sm:text-3xl">{title}</h1>
        {children}
      </main>
      <footer className="flex justify-between border-t border-[#e6e6e6] px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-[#9a9a9a] sm:px-6" style={mono}>
        <span>© {new Date().getFullYear()} NOVO</span>
        <Link href="/privatnost" className="hover:text-black">
          Privatnost
        </Link>
      </footer>
    </div>
  );
}

function Calm({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[15px] leading-relaxed text-[#6b6b6b]">{children}</p>;
}

export default async function OptOutPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ gotovo?: string; greska?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`o:view:${ip}`, 60, 60_000).ok) {
    return (
      <Shell kicker="Odjava" title="Pokušajte malo kasnije">
        <Calm>Previše je zahtjeva u kratko vrijeme. Pričekajte minutu pa ponovno otvorite poveznicu iz poruke.</Calm>
      </Shell>
    );
  }

  await ensureReviewsDb();
  const found = await lookupOptOut(token).catch(() => null);

  if (!found) {
    return (
      <Shell kicker="Odjava" title="Nešto je pošlo po zlu">
        <Calm>Stranica trenutno nije dostupna. Pokušajte ponovno za nekoliko minuta.</Calm>
      </Shell>
    );
  }

  if (!found.valid) {
    return (
      <Shell kicker="Odjava" title="Poveznica više ne vrijedi">
        <Calm>
          Ova poveznica za odjavu nije valjana ili je istekla. Ako i dalje primate naše poruke, javite nam se na{" "}
          <a href={`mailto:${env.salesEmail}`} className="break-all font-bold text-black underline underline-offset-4">
            {env.salesEmail}
          </a>
          .
        </Calm>
      </Shell>
    );
  }

  if (found.optedOut) {
    return (
      <Shell kicker="Odjava" title="Odjavljeni ste">
        <Calm>
          {sp.gotovo === "1" ? "Gotovo. " : "Već ste odjavljeni. "}
          Više vam nećemo slati SMS poruke, ni u ime tvrtke {found.businessName} ni u ime drugih tvrtki koje koriste NOVO Recenzije.
        </Calm>
        <Calm>Odjavu možete zatvoriti. Ako je odjava greška, javite se tvrtki {found.businessName}.</Calm>
      </Shell>
    );
  }

  return (
    <Shell kicker="Odjava" title="Odjava s poruka">
      <Calm>
        Ne želite više primati SMS poruke od tvrtke <strong className="text-black">{found.businessName}</strong>? Potvrdite odjavu jednim klikom. Vaš broj tada
        brišemo iz slanja i za druge tvrtke koje koriste NOVO Recenzije.
      </Calm>
      {sp.greska && (
        <p role="alert" className="mt-5 border-l-[3px] border-[#ff7f00] bg-[#ff7f00]/10 px-3 py-2 text-sm">
          {sp.greska === "limit" ? "Previše pokušaja. Pričekajte minutu pa pokušajte ponovno." : "Odjava nije uspjela. Pokušajte ponovno."}
        </p>
      )}
      <form action={optOutAction} className="mt-8">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full bg-black px-6 py-3.5 text-sm font-bold text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0000c3] sm:w-auto"
        >
          Odjavi me s poruka
        </button>
      </form>
      <p className="mt-6 text-xs text-[#9a9a9a]">Ako ste poveznicu otvorili greškom, samo zatvorite stranicu: ništa se neće promijeniti.</p>
    </Shell>
  );
}
