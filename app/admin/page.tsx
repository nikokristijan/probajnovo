import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listProperties, listStudies } from "@/lib/db/queries";

export default async function AdminDashboard() {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");

  const [properties, studies] = await Promise.all([listProperties(), listStudies()]);
  const publishedCount = properties.filter((p) => p.published).length;
  const inStudiesCount = properties.filter((p) => p.showInStudies).length;

  return (
    <div className="flex flex-col gap-12">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Vikendice" value={properties.length} />
        <StatCard label="Objavljeno" value={publishedCount} />
        <StatCard label="U Studies popisu" value={inStudiesCount} />
        <StatCard label="Studies unosi" value={studies.length} />
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40 mb-3">
          Brze radnje
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/properties/new" className="admin-quicklink">
            + Nova vikendica
          </Link>
          <Link href="/admin/studies/new" className="admin-quicklink">
            + Novi Study
          </Link>
          <Link href="/admin/agency" className="admin-quicklink">
            Sadržaj agencije
          </Link>
          {admin.isSuperAdmin && (
            <Link href="/admin/admins" className="admin-quicklink">
              Upravljaj adminima
            </Link>
          )}
          <Link href="/" target="_blank" className="admin-quicklink">
            Pogledaj stranicu ↗
          </Link>
        </div>
      </section>

      <section>
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
                    novo.hr/{p.slug} · {p.location} · {p.layoutStyle}
                    {p.darkMode ? " · dark" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.showInStudies && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0000c3]/10 text-[#0000c3]">
                      u studies
                    </span>
                  )}
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Studies</h1>
            <p className="text-xs text-black/50 mt-0.5">
              Opći portfolio unosi (brend identitet, digitalni dizajn, film…) — prikazuju se
              u STUDIES popisu na naslovnici, bez vlastite stranice.
            </p>
          </div>
          <Link
            href="/admin/studies/new"
            className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 shrink-0"
          >
            + Dodaj Study
          </Link>
        </div>

        {studies.length === 0 ? (
          <p className="text-sm text-black/60">
            Još nema dodanih Studies unosa. Klikni &ldquo;Dodaj Study&rdquo; da napraviš prvi.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {studies.map((s) => (
              <Link
                key={s.id}
                href={`/admin/studies/${s.id}`}
                className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 bg-white hover:border-[#0000c3]/40"
              >
                <div>
                  <div className="font-semibold text-sm">{s.title}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    {s.category} · {s.year}
                  </div>
                </div>
                <span
                  className={
                    "text-xs font-semibold px-2.5 py-1 rounded-full " +
                    (s.published
                      ? "bg-green-100 text-green-700"
                      : "bg-black/5 text-black/50")
                  }
                >
                  {s.published ? "objavljeno" : "skriveno"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-black/10 rounded-xl px-4 py-3 bg-white">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-black/50 mt-0.5">{label}</div>
    </div>
  );
}
