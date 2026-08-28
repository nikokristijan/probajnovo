import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

export const metadata: Metadata = {
  title: "NOVO — admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

return (
  <div className="admin-shell">
  <header className="flex items-center justify-between px-6 py-4 border-b border-black/10 bg-white">
  <span className="font-bold tracking-tight">
  NOVO <span className="text-[#ff7f00]">admin</span>
  </span>
    {admin && (
    <nav className="flex items-center gap-5 text-sm">
    <Link href="/admin" className="hover:text-[#ff7f00]">
    Vikendice
    </Link><Link href="/admin/agency" className="hover:text-[#ff7f00]">
    Sadržaj agencije
    </Link>
  <Link href="/" className="hover:text-[#ff7f00]" target="_blank">
  Pogledaj stranicu ↗
  </Link>
  <span className="text-black/40">{admin.email}</span>
  <form action={logoutAction}>
    <button
      type="submit"
      className="rounded-full border border-black/15 px-3 py-1.5 hover:border-[#ff7f00] hover:text-[#ff7f00]"
      >
    Odjava
    </button>
  </form>
    </nav>
    )}
  </header>
    <main className="max-w-3xl mx-auto px-6 py-10">{children}</main>
  </div>
  );
}

