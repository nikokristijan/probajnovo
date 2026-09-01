import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { hasPushSubscription } from "@/lib/db/queries";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import TwoFactorSetupForm from "@/components/admin/TwoFactorSetupForm";
import PushNotificationToggle from "@/components/admin/PushNotificationToggle";
import BroadcastPushForm from "@/components/admin/BroadcastPushForm";
import RunPushMigrationButton from "@/components/admin/RunPushMigrationButton";

export default async function AdminSettingsPage() {
  const me = await getCurrentAdminRecord();
  if (!me) redirect("/admin/login");
  // Best-effort — isti duh kao lib/push.ts sendPushToAdmins: ako upit padne
  // (npr. push_subscriptions tablica još ne postoji jer migracija nije
  // pokrenuta), radije prikaži postavke s pretpostavkom "nije pretplaćen"
  // nego da cijela stranica (lozinka, 2FA, sve) padne u grešku. `pushDbBroken`
  // pamti TO stanje da ispod umjesto prekidača ponudimo puno adminu gumb
  // "Popravi bazu" (vidi RunPushMigrationButton) — nema smisla nuditi
  // "Uključi obavijesti" kad znamo da će spremanje pretplate opet pući.
  let alreadySubscribed = false;
  let pushDbBroken = false;
  try {
    alreadySubscribed = await hasPushSubscription(me.id);
  } catch (err) {
    console.error("[AdminSettingsPage] hasPushSubscription nije uspio:", err);
    pushDbBroken = true;
  }

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
        {pushDbBroken && me.role === "admin" ? (
          <RunPushMigrationButton />
        ) : pushDbBroken ? (
          <p className="text-sm text-red-600">
            Obavijesti trenutno nisu dostupne — javi punom adminu da to popravi.
          </p>
        ) : (
          <PushNotificationToggle initialSubscribed={alreadySubscribed} />
        )}
      </div>

      {/* Broadcast — samo puni admini (ne vlasnici), vidi requireAdmin u
          sendBroadcastPushAction. Šalje se svim pretplaćenim uređajima svih
          admina (uključujući vlasnike), ne samo onima koji ovo vide. */}
      {me.role === "admin" && (
        <div className="border border-black/10 rounded-xl p-5 flex flex-col gap-4 bg-black/[0.02] max-w-sm">
          <span className="text-sm font-semibold">Pošalji obavijest svim uređajima</span>
          <BroadcastPushForm />
        </div>
      )}
    </div>
  );
}
