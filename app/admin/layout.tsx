import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdminRecord } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

export const metadata: Metadata = {
  title: "NOVO — admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdminRecord();

  return (
    <div className="admin-shell">
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/10 bg-white flex-wrap gap-3">
        <span className="font-bold tracking-tight">
          NOVO <span className="text-[#ff7f00]">admin</span>
        </span>
        {admin && (
          <nav className="flex items-center gap-5 text-sm flex-wrap">
            <Link href="/admin" className="hover:text-[#ff7f00]">
              Pregled
            </Link>
            <Link href="/admin/agency" className="hover:text-[#ff7f00]">
              Sadržaj agencije
            </Link>
            <Link href="/admin#firme" className="hover:text-[#ff7f00]">
              Firme
            </Link>
            <Link href="/admin/inquiries" className="hover:text-[#ff7f00]">
              Upiti
            </Link>
            {admin.isSuperAdmin && (
              <Link href="/admin/admins" className="hover:text-[#ff7f00]">
                Admini
              </Link>
            )}
            <Link href="/admin/settings" className="hover:text-[#ff7f00]">
              Postavke
            </Link>
            <Link href="/" className="hover:text-[#ff7f00]" target="_blank">
              Pogledaj stranicu ↗
            </Link>
            <span className="text-black/40 flex items-center gap-1.5">
              {admin.email}
              {admin.isSuperAdmin && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ff7f00]/10 text-[#ff7f00]">
                  glavni
                </span>
              )}
            </span>
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
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}

