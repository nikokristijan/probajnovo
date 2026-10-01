import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  getAdminById,
  getAdminAccessGrants,
  listProperties,
  listCompanies,
  getAdminInviteStatuses,
} from "@/lib/db/queries";
import { resetAdminTwoFactorAction } from "@/lib/actions-superadmin";
import EditAdminForm from "@/components/admin/EditAdminForm";
import ResendInviteButton from "@/components/admin/ResendInviteButton";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

/** Uređivanje admina ili vlasnika (plan #14) — samo glavni admin. */
export default async function EditAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ spremljeno?: string }>;
}) {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");
  if (!me.isSuperAdmin) redirect("/admin");

  const { id } = await params;
  const sp = await searchParams;
  const adminId = Number(id);
  if (!Number.isInteger(adminId)) notFound();

  const [target, grants, properties, companies, invites] = await Promise.all([
    getAdminById(adminId),
    getAdminAccessGrants(adminId),
    listProperties(),
    listCompanies(),
    getAdminInviteStatuses(),
  ]);
  if (!target) notFound();
  const invite = invites.get(adminId);
  const isMe = target.id === me.id;

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <Link href="/admin/admins" className="text-xs font-semibold text-black/60 hover:text-black">
          ← Admini
        </Link>
        <h1 className="text-xl font-bold mt-1">{target.displayName?.trim() || target.email}</h1>
        <p className="text-sm text-black/60 mt-0.5">
          {target.email} · {target.isSuperAdmin ? "Glavni admin" : target.role === "owner" ? "Vlasnik" : "Admin"} · dodan{" "}
          {target.createdAt.toLocaleDateString("hr-HR")}
        </p>
      </div>

      {sp.spremljeno === "2fa" && (
        <p className="text-sm rounded-lg border border-[#0a7a3e]/30 bg-[#0a7a3e]/5 px-3 py-2" role="status">
          Dvofaktorska prijava je isključena. Osoba se sad prijavljuje samo lozinkom i može je ponovno uključiti u Postavkama.
        </p>
      )}

      <section className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Uloga i pristup</h2>
        <EditAdminForm
          adminId={target.id}
          isSuperAdmin={target.isSuperAdmin}
          initial={{
            role: target.role === "owner" ? "owner" : "admin",
            displayName: target.displayName ?? "",
            jobTitle: target.jobTitle ?? "",
            propertyIds: grants.map((g) => g.propertyId).filter((x): x is number => x != null),
            companyIds: grants.map((g) => g.companyId).filter((x): x is number => x != null),
          }}
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        />
      </section>

      {!isMe && (
        <section className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Prijava</h2>
          <p className="text-sm text-black/70">
            {invite?.pending
              ? "Pozivnica je poslana, ali osoba još nije postavila lozinku."
              : invite?.expired
                ? "Pozivnica je istekla prije nego što ju je osoba iskoristila."
                : "Zaboravljena lozinka? Pošalji link za novu — stara prestaje vrijediti tek kad osoba postavi novu."}
          </p>
          <ResendInviteButton adminId={target.id} label={invite?.pending || invite?.expired ? "Pošalji pozivnicu ponovno" : "Pošalji link za novu lozinku"} />
          {target.twoFactorEnabled && (
            <div className="flex flex-col gap-2 pt-3 border-t border-black/10">
              <p className="text-sm text-black/70">
                Uključena je dvofaktorska prijava. Ako je osoba izgubila mobitel, isključi je ovdje.
              </p>
              <ConfirmSubmit
                action={resetAdminTwoFactorAction.bind(null, target.id)}
                title={`Isključiti dvofaktorsku prijavu za ${target.email}?`}
                description="Do ponovnog uključivanja prijava će tražiti samo lozinku."
                confirmLabel="Isključi 2FA"
                cancelLabel="Odustani"
                buttonLabel="Isključi 2FA"
                buttonClassName="self-start text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
