import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import { findAdminByEmail } from "@/lib/db/queries";
import AdminProfileForm from "@/components/admin/AdminProfileForm";
import { colorFor, initialsFor, labelForEmail } from "@/components/admin/portalUtils";
import { ChatIcon } from "@/components/admin/Icons";

/**
 * Profil admina (Portal Faza 3, "svaki admin da ima svoj profil") — vlastiti
 * profil je uredljiv (AdminProfileForm), tuđi je samo pregled + prečac na
 * DM. Vlasnici (role="owner") nemaju Portal profil — notFound() umjesto
 * praznog/pogrešnog prikaza.
 */
export default async function AdminProfilePage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const targetEmail = decodeURIComponent(email);
  const admin = await requireFullAdmin();

  const target = await findAdminByEmail(targetEmail);
  if (!target || target.role === "owner") notFound();

  const isSelf = target.email === admin.email;
  const label = labelForEmail(target.email, [{ email: target.email, displayName: target.displayName }]);

  return (
    <div className="flex flex-col gap-5">
      <div className="portal-profile-header">
        <span className="portal-profile-avatar" style={{ background: colorFor(target.email) }}>
          {initialsFor(label)}
        </span>
        <div>
          <h2 className="text-lg font-bold">{label}</h2>
          {target.jobTitle && (
            <p className="text-sm" style={{ color: "var(--neu-ink-faint)" }}>
              {target.jobTitle}
            </p>
          )}
          <p className="text-xs mt-0.5" style={{ color: "var(--neu-ink-faint)" }}>
            {target.email}
            {target.isSuperAdmin && " · glavni admin"}
          </p>
        </div>
        {!isSelf && (
          <Link href={`/admin/portal/dm/${encodeURIComponent(target.email)}`} className="neu-btn px-4 py-2 text-sm font-semibold ml-auto">
            <ChatIcon size={15} /> Pošalji poruku
          </Link>
        )}
      </div>

      {isSelf ? (
        <AdminProfileForm
          initialDisplayName={target.displayName ?? ""}
          initialJobTitle={target.jobTitle ?? ""}
          initialBio={target.bio ?? ""}
        />
      ) : (
        <div className="neu-card p-5 max-w-md">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
            Bio
          </span>
          <p className="text-sm mt-2 leading-relaxed">
            {target.bio || <span style={{ color: "var(--neu-ink-faint)" }}>Nema opisa.</span>}
          </p>
        </div>
      )}
    </div>
  );
}
