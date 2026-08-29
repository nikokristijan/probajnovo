import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listAdmins } from "@/lib/db/queries";
import DeleteAdminButton from "@/components/admin/DeleteAdminButton";

export default async function AdminsPage() {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");
  if (!me.isSuperAdmin) redirect("/admin");

  const admins = await listAdmins();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Admini</h1>
          <p className="text-xs text-black/50 mt-0.5">
            Samo glavni admin (ti) može dodavati ili micati druge admine.
          </p>
        </div>
        <Link
          href="/admin/admins/new"
          className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 shrink-0"
        >
          + Dodaj admina
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {admins.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 bg-white"
          >
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                {a.email}
                {a.id === me.id && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/5 text-black/50">
                    ti
                  </span>
                )}
              </div>
              <div className="text-xs text-black/50 mt-0.5">
                {a.isSuperAdmin ? "Glavni admin" : "Admin"} · dodan{" "}
                {a.createdAt.toLocaleDateString("hr-HR")}
              </div>
            </div>
            {a.isSuperAdmin ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ff7f00]/10 text-[#ff7f00]">
                glavni
              </span>
            ) : (
              <DeleteAdminButton id={a.id} email={a.email} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
