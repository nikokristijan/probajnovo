import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { listProperties } from "@/lib/db/queries";

export default async function AdminDashboard() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

const properties = await listProperties();

  return (
  <div>
  <div className="flex items-center justify-between mb-6">
  <h1 className="text-xl font-bold">Vikendice</h1>
  <Link
  href="/admin/properties/new"
  className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2"
  >
  + Dodaj vikendicu
  </Link>
  </div>

  {properties.length === 0 ? (
  <p className="text-sm text-black/60">
  Još nema dodanih vikendica. Klikni &ldquo;Dodaj vikendicu&rdquo; da napraviš prvu.
  </p>
  ) : (
  <div className="flex flex-col gap-2">
  {properties.map((p) => (
  <Link
  key={p.id}
  href={`/admin/properties/${p.id}`}
  className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 bg-white hover:border-[#0000c3]/40"
  >
  <div>
  <div className="font-semibold text-sm">{p.name}</div>
  <div className="text-xs text-black/50 mt-0.5">
  novo.hr/{p.slug} · {p.location}
  </div>
  </div>
  <span
  className={
  "text-xs font-semibold px-2.5 py-1 rounded-full " +
  (p.published
  ? "bg-green-100 text-green-700"
  : "bg-black/5 text-black/50")
  }
  >
  {p.published ? "objavljeno" : "skriveno"}
  </span>
  </Link>
  ))}
  </div>
  )}
  </div>
  );
  }
  
