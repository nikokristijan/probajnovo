import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { hasPushSubscription, listLatestCronRuns, type CronRunRow } from "@/lib/db/queries";
import { isCronSecretConfigured } from "@/lib/cron";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import TwoFactorSetupForm from "@/components/admin/TwoFactorSetupForm";
import PushNotificationToggle from "@/components/admin/PushNotificationToggle";
import BroadcastPushForm from "@/components/admin/BroadcastPushForm";
import RunPushMigrationButton from "@/components/admin/RunPushMigrationButton";
import OwnerChangePasswordForm from "@/components/admin/OwnerChangePasswordForm";
import OwnerTwoFactorSetupForm from "@/components/admin/OwnerTwoFactorSetupForm";
import OwnerPushNotificationToggle from "@/components/admin/OwnerPushNotificationToggle";
import OwnerThemeToggle from "@/components/admin/OwnerThemeToggle";
import { logoutAction } from "@/lib/actions";

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

  const cronRuns: CronRunRow[] =
    me.role === "admin" && me.isSuperAdmin ? await listLatestCronRuns().catch(() => []) : [];

  // Vlasnički staklen prikaz — NAMJERNO odvojena grana (vidi OwnerMiniCalendar
  // za obrazloženje obrasca), puni admin ispod ostaje potpuno nepromijenjen.
  if (me.role === "owner") {
    return (
      <div className="owner-dash flex flex-col gap-6" data-theme={me.themePreference ?? "system"}>
        <div>
          <h1 className="text-xl font-bold">Postavke</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--od-ink-faint)" }}>
            Prijavljen kao {me.email}
          </p>
        </div>

        {/* Plan #52: tema je ovdje (ranije na Početnoj, s emojijima). */}
        <div className="owner-glass owner-glass-grain rounded-2xl p-5 flex flex-col gap-3 max-w-sm">
          <span className="text-sm font-semibold">Izgled</span>
          <OwnerThemeToggle initialTheme={(me.themePreference as "light" | "dark" | "system" | null) ?? "system"} />
        </div>

        <div className="owner-glass owner-glass-grain rounded-2xl p-5 flex flex-col gap-4 max-w-sm">
          <span className="text-sm font-semibold">Promijeni lozinku</span>
          <OwnerChangePasswordForm />
        </div>

        <div className="owner-glass owner-glass-grain rounded-2xl p-5 flex flex-col gap-4 max-w-sm">
          <span className="text-sm font-semibold">Dvofaktorska prijava (2FA)</span>
          <OwnerTwoFactorSetupForm initialEnabled={me.twoFactorEnabled} />
        </div>

        <div className="owner-glass owner-glass-grain rounded-2xl p-5 flex flex-col gap-4 max-w-sm">
          <span className="text-sm font-semibold">Obavijesti na uređaju</span>
          {pushDbBroken ? (
            <p className="text-sm text-red-400">
              Obavijesti trenutno nisu dostupne — javi punom adminu da to popravi.
            </p>
          ) : (
            <OwnerPushNotificationToggle initialSubscribed={alreadySubscribed} />
          )}
        </div>

        {/* Plan #34: Odjava je ovdje umjesto u gornjoj traci na mobitelu. */}
        <form action={logoutAction} className="max-w-sm">
          <button type="submit" className="owner-quicklink w-full justify-center">
            Odjavi se
          </button>
        </form>
      </div>
    );
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

      {/* Broadcast — samo superadmin (plan #6), vidi requireSuperAdmin u
          sendBroadcastPushAction. Šalje se svim pretplaćenim uređajima svih
          admina (uključujući vlasnike), ne samo onima koji ovo vide. */}
      {me.role === "admin" && me.isSuperAdmin && (
        <div className="border border-black/10 rounded-xl p-5 flex flex-col gap-4 bg-black/[0.02] max-w-sm">
          <span className="text-sm font-semibold">Pošalji obavijest svim uređajima</span>
          <BroadcastPushForm />
        </div>
      )}

      {me.role === "admin" && me.isSuperAdmin && <CronStatusPanel runs={cronRuns} />}
    </div>
  );
}

/* Automatski poslovi (plan #4 + #30) — kad je koji cron zadnji put radio i
   je li uspio, plus upozorenje dok CRON_SECRET nije postavljen na Vercelu. */
const CRON_JOBS: { name: string; label: string; schedule: string; maxAgeHours: number }[] = [
  { name: "sync-ical", label: "Sinkronizacija iCal kalendara", schedule: "svaki dan u 5:00", maxAgeHours: 26 },
  { name: "reservation-reminders", label: "Podsjetnici gostima i pretplate", schedule: "svaki dan u 10:00", maxAgeHours: 26 },
  { name: "review-requests", label: "Molbe za recenziju", schedule: "svaki dan u 11:00", maxAgeHours: 26 },
  { name: "weekly-digest", label: "Tjedni pregled upita", schedule: "ponedjeljkom u 9:00", maxAgeHours: 24 * 7 + 2 },
  { name: "weekly-backup", label: "Tjedni backup mailom", schedule: "nedjeljom u 7:00", maxAgeHours: 24 * 7 + 2 },
];

function formatWhen(ts: string | null): string {
  if (!ts) return "nikad";
  const d = new Date(ts.replace(" ", "T") + (/[zZ+]/.test(ts.slice(10)) ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("hr-HR", { timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CronStatusPanel({ runs }: { runs: CronRunRow[] }) {
  const secretOk = isCronSecretConfigured();
  const byName = new Map(runs.map((r) => [r.name, r]));
  return (
    <div className="border border-black/10 rounded-xl p-5 flex flex-col gap-4 bg-black/[0.02] max-w-2xl">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Automatski poslovi</span>
        <span className="text-xs text-black/60">Vremena su po hrvatskom vremenu (ljeti).</span>
      </div>
      {!secretOk && (
        <p className="text-sm rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2">
          <strong>CRON_SECRET nije postavljen.</strong> Poslovi rade, ali su slabije zaštićeni. U Vercelu
          (Settings → Environment Variables) dodaj CRON_SECRET s dugim nasumičnim nizom i ponovno objavi stranicu.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-black/10">
        {CRON_JOBS.map((job) => {
          const run = byName.get(job.name);
          const stale = run?.hoursSinceOk == null || run.hoursSinceOk > job.maxAgeHours;
          const state = !run ? "nepoznato" : !run.ok ? "greška" : stale ? "kasni" : "u redu";
          const tone =
            state === "u redu"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : state === "nepoznato"
                ? "bg-black/[0.04] text-black/70 border-black/10"
                : "bg-red-50 text-red-800 border-red-200";
          return (
            <li key={job.name} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex-1 min-w-[12rem]">
                <div className="text-sm font-medium">{job.label}</div>
                <div className="text-xs text-black/60">
                  {job.schedule} · zadnje: {formatWhen(run?.finishedAt ?? null)}
                  {run && run.failuresLast7d > 0 ? ` · ${run.failuresLast7d}× greška u 7 dana` : ""}
                </div>
                {run && !run.ok && run.summary && (
                  <div className="text-xs text-red-700 mt-0.5 break-words">{run.summary}</div>
                )}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tone}`}>{state}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
