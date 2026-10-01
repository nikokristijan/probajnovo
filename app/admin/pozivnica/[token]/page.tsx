import { createHash } from "crypto";
import Link from "next/link";
import { findAdminByInviteHash } from "@/lib/db/queries";
import AcceptInviteForm from "@/components/admin/AcceptInviteForm";

/**
 * Javna stranica pozivnice (plan #13) — osoba je otvorila link iz e-maila i
 * ovdje postavlja svoju lozinku. Proxy je pušta bez sesije (vidi proxy.ts);
 * sam token je dokaz, u bazi je samo njegov hash.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = /^[A-Za-z0-9_-]{20,100}$/.test(token)
    ? await findAdminByInviteHash(createHash("sha256").update(token).digest("hex"))
    : null;

  if (!admin) {
    return (
      <div className="max-w-sm flex flex-col gap-3">
        <h1 className="text-xl font-bold">Link više ne vrijedi</h1>
        <p className="text-sm text-black/70 leading-relaxed">
          Pozivnica je istekla ili je već iskorištena. Javi se osobi koja te pozvala da ti pošalje novi
          link, ili se prijavi ako si lozinku već postavio.
        </p>
        <Link href="/admin/login" className="text-sm font-semibold underline underline-offset-4 w-fit">
          Na prijavu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm flex flex-col gap-1">
      <h1 className="text-xl font-bold">Postavi lozinku</h1>
      <p className="text-sm text-black/70 mb-5">
        Račun: <span className="font-semibold">{admin.email}</span>. Nakon spremanja odmah si unutra.
      </p>
      <AcceptInviteForm token={token} />
    </div>
  );
}
