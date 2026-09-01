import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { hasPushSubscription } from "@/lib/db/queries";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import TwoFactorSetupForm from "@/components/admin/TwoFactorSetupForm";
import PushNotificationToggle from "@/components/admin/PushNotificationToggle";

export default async function AdminSettingsPage() {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");
  const alreadySubscribed = await hasPushSubscription(me.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold">Postavke</h1>
        <p className="text-xs text-black/50 mt-0.5">Prijavljen kao {me.email}</p>
      </div>

      <div className="border border-black/10 rounded-xl p-5 flex flex-col gap-4 bg-black/[0.02] max-w-sm">
        <span className="text-sm font-semibold">Promijeni lozinku</span>
        <ChangePasswordForm />
      </div>

      <div className="border border-black/10 rounded-xl p-5 flex flex-col gap-4 bg-black/[0.02] max-w-sm">
        <span className="text-sm font-semibold">Dvofaktorska prijava (2FA)</span>
        <TwoFactorSetupForm initialEnabled={me.twoFactorEnabled} />
      </div>

      <div className="border border-black/10 rounded-xl p-5 flex flex-col gap-4 bg-black/[0.02] max-w-sm">
        <span className="text-sm font-semibold">Obavijesti na uređaju</span>
        <PushNotificationToggle initialSubscribed={alreadySubscribed} />
      </div>
    </div>
  );
}
