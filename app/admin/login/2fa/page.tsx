import { redirect } from "next/navigation";
import { getPendingTwoFactorAdminId } from "@/lib/auth";
import TwoFactorLoginForm from "@/components/admin/TwoFactorLoginForm";

/**
 * Drugi korak prijave za admine s uključenim 2FA (vidi lib/actions.ts
 * loginAction/verifyTwoFactorLoginAction) — dolazi se ovamo TEK nakon
 * ispravne email+lozinke, preko kratkotrajnog "pending 2FA" kolačića. Ako
 * kolačić nedostaje/istekao je (npr. netko otvori ovu adresu izravno), vraća
 * na običnu prijavu.
 */
export default async function AdminTwoFactorLoginPage() {
  const adminId = await getPendingTwoFactorAdminId();
  if (!adminId) redirect("/admin/login");

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Dvofaktorska prijava</h1>
      <p className="text-sm text-black/60 mb-6">
        Unesi 6-znamenkasti kod iz svoje aplikacije za autentifikaciju (npr. Google Authenticator).
      </p>
      <TwoFactorLoginForm />
    </div>
  );
}
