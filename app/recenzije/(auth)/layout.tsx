import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/recenzije/brand";

/** Prijava nije javno oglašena (služi NOVO timu i postojećim računima), pa je ne indeksiramo. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <Logo />
        <Link href="/recenzije" className="label text-muted hover:text-foreground">
          ← O usluzi
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[420px] flex-1 px-4 py-12 sm:px-0">{children}</main>
      <footer className="label flex justify-between border-t border-border px-4 py-3 text-subtle sm:px-6">
        <span>© {new Date().getFullYear()} NOVO</span>
        <Link href="/privatnost" className="hover:text-foreground">
          Privatnost
        </Link>
      </footer>
    </div>
  );
}
