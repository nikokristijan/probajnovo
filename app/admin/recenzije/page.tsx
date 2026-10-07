import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import RecenzijeInviteCodes, { type InviteCodeView } from "@/components/admin/RecenzijeInviteCodes";
import { StatCard } from "@/components/admin/StatCard";
import { activatePlanAction, deactivateAction, extendTrialAction } from "@/lib/recenzije/actions/novo-admin";
import { envInviteCodeCount, listInviteCodes } from "@/lib/recenzije/services/invites";
import {
  listOrganizationsForNovoAdmin,
  listPlansForNovoAdmin,
  summarize,
  type AdminOrgRow,
} from "@/lib/recenzije/services/novo-admin";

export const dynamic = "force-dynamic";

/**
 * NOVO Recenzije — pregled za glavnog admina: sve tvrtke koje koriste
 * aplikaciju (/recenzije), paket, potrošnja SMS-a, što još nisu postavile,
 * te ručna aktivacija paketa / produženje probe za tvrtke koje plaćaju
 * virmanom. Demo tvrtka je izostavljena. Isti uvjet pristupa kao Financije.
 */

const STATE: Record<AdminOrgRow["state"], { label: string; cls: string }> = {
  active: { label: "aktivan", cls: "bg-[#0b7a3e]/10 text-[#0b7a3e]" },
  trial: { label: "proba", cls: "bg-[#0000c3]/10 text-[#0000c3]" },
  trial_expired: { label: "proba istekla", cls: "bg-[#ff7f00]/12 text-[#9a4a00]" },
  expired: { label: "paket istekao", cls: "bg-[#ff7f00]/12 text-[#9a4a00]" },
  inactive: { label: "neaktivan", cls: "bg-black/5 text-black/55" },
};

function date(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("hr-HR");
}

/** Datum za pozivne kodove: fiksna vremenska zona da prikaz ne ovisi o poslužitelju. */
function inviteDate(d: Date | null) {
  return d ? d.toLocaleDateString("hr-HR", { timeZone: "Europe/Zagreb" }) : null;
}

function daysFrom(d: Date | string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function eur(cents: number) {
  return (cents / 100).toLocaleString("hr-HR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "text-[11px] font-semibold px-2 py-0.5 rounded-full " +
        (ok ? "bg-[#0b7a3e]/10 text-[#0b7a3e]" : "bg-black/5 text-black/45 line-through decoration-black/30")
      }
    >
      {label}
    </span>
  );
}

export default async function AdminRecenzijePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; greska?: string }>;
}) {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (!admin.isSuperAdmin) redirect("/admin");

  const sp = await searchParams;
  const [rows, plans, invites] = await Promise.all([
    listOrganizationsForNovoAdmin(),
    listPlansForNovoAdmin(),
    listInviteCodes(),
  ]);
  const sum = summarize(rows);
  const inviteViews: InviteCodeView[] = invites.map((c) => ({
    id: c.id,
    code: c.code,
    label: c.label,
    status: c.status,
    uses: c.uses,
    maxUses: c.maxUses,
    expiresLabel: inviteDate(c.expiresAt),
    createdLabel: inviteDate(c.createdAt) ?? "",
    lastUsedBy: c.lastUsedBy,
    lastUsedLabel: inviteDate(c.lastUsedAt),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Recenzije</h1>
          <p className="text-xs text-black/50 mt-0.5 max-w-[60ch]">
            Tvrtke koje koriste NOVO Recenzije, njihov paket i potrošnja. Paket koji plaćaju virmanom aktiviraš ovdje
            ručno, a pozivnim kodovima određuješ tko smije otvoriti račun. Vidljivo samo glavnom adminu.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/recenzije"
            target="_blank"
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
          >
            Stranica proizvoda ↗
          </Link>
          <Link
            href="/recenzije/prijava"
            target="_blank"
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white"
          >
            Prijava u aplikaciju ↗
          </Link>
        </div>
      </div>

      {sp.ok && (
        <div role="status" className="rounded-xl border border-[#0b7a3e]/30 bg-[#0b7a3e]/5 px-4 py-2.5 text-sm">
          Spremljeno · {sp.ok}
        </div>
      )}
      {sp.greska && (
        <div role="alert" className="rounded-xl border border-[#d70015]/30 bg-[#d70015]/5 px-4 py-2.5 text-sm text-[#b80012]">
          {sp.greska}
        </div>
      )}

      <section className="admin-animate-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Tvrtke" value={sum.total} />
        <StatCard label="Plaćaju" value={sum.paying} />
        <StatCard label="Na probi" value={sum.trial} />
        <StatCard label="Neaktivne" value={sum.lapsed} />
        <StatCard label="MRR (bez PDV-a)" value={Math.round(sum.mrrCents / 100)} suffix=" €" />
        <StatCard label="SMS u 30 dana" value={sum.sms30d} />
      </section>

      <RecenzijeInviteCodes codes={inviteViews} envCount={envInviteCodeCount()} />

      {rows.length === 0 ? (
        <div className="neu-card px-5 py-8 text-center text-sm text-black/60">
          Još se nijedna tvrtka nije registrirala. Kad se netko prijavi na{" "}
          <Link href="/recenzije/registracija" className="underline" target="_blank">
            /recenzije/registracija
          </Link>
          , pojavit će se ovdje.
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">Tvrtke ({rows.length})</h2>
          {rows.map((r) => {
            const st = STATE[r.state];
            const left = daysFrom(r.endsAt);
            const pct = Math.min(100, Math.round((r.smsThisMonth / Math.max(1, r.smsLimit)) * 100));
            return (
              <article key={r.id} className="neu-card px-4 py-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      {r.name}
                      <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + st.cls}>{st.label}</span>
                      {r.viaStripe && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/5 text-black/55">Stripe</span>
                      )}
                    </div>
                    <div className="text-xs text-black/55 mt-0.5 break-words">
                      {r.ownerName ? `${r.ownerName} · ` : ""}
                      {r.ownerEmail ? (
                        <a href={`mailto:${r.ownerEmail}`} className="underline decoration-black/20">
                          {r.ownerEmail}
                        </a>
                      ) : (
                        "bez vlasnika"
                      )}
                      {r.industry ? ` · ${r.industry}` : ""} · registrirana {date(r.createdAt)}
                      {r.members > 1 ? ` · članova: ${r.members}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <div className="font-semibold text-sm">
                      {r.planName ? `${r.planName} · ${eur(r.planPriceCents ?? 0)} €/mj` : "Besplatna proba"}
                    </div>
                    <div className="text-black/55">
                      {r.endsAt
                        ? `${r.state === "trial" || r.state === "trial_expired" ? "Proba" : r.viaStripe ? "Obnova" : "Vrijedi"} do ${date(r.endsAt)}${
                            left != null && left >= 0 ? ` (još ${left} d)` : ""
                          }`
                        : "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex justify-between text-black/55">
                      <span>SMS ovaj mjesec</span>
                      <span className="tabular-nums font-semibold text-black">
                        {r.smsThisMonth}/{r.smsLimit}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
                      <div
                        className={"h-full rounded-full " + (pct > 90 ? "bg-[#d70015]" : "bg-[#ff7f00]")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-black/55">Klijenti </span>
                    <b className="tabular-nums">{r.clients}</b>
                  </div>
                  <div>
                    <span className="text-black/55">Klikovi (30 d) </span>
                    <b className="tabular-nums">{r.clicks30d}</b>
                  </div>
                  <div>
                    <span className="text-black/55">Neuspjeli SMS (30 d) </span>
                    <b className={"tabular-nums " + (r.failed30d > 0 ? "text-[#b80012]" : "")}>{r.failed30d}</b>
                  </div>
                  <div>
                    <span className="text-black/55">Recenzije </span>
                    <b className="tabular-nums">{r.reviews}</b>
                    <span className="text-black/40"> · zadnji SMS {date(r.lastMessageAt)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Check ok={r.hasReviewUrl} label="Google link" />
                  <Check ok={r.hasGateway} label="Mobitel za SMS" />
                  <Check ok={r.googleConnected} label="Google profil povezan" />
                </div>

                {r.viaStripe ? (
                  <p className="text-xs text-black/50">Plaća preko Stripea: paket i otkaz mijenjaju se u Stripeu.</p>
                ) : (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-semibold text-black/70 hover:text-black list-none inline-flex items-center gap-1">
                      <span className="transition-transform group-open:rotate-90">›</span> Upravljaj paketom
                    </summary>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                      <form action={activatePlanAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="orgId" value={r.id} />
                        <label className="flex flex-col gap-1 text-xs text-black/60">
                          Paket
                          <select
                            name="planKey"
                            defaultValue={r.sub?.planKey && r.sub.planKey !== "trial" ? r.sub.planKey : (plans[0]?.key ?? "")}
                            className="admin-input text-sm"
                          >
                            {plans.map((p) => (
                              <option key={p.key} value={p.key}>
                                {p.name} · {eur(p.priceMonthlyCents)} € · {p.smsMonthlyLimit} SMS
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-black/60">
                          Mjeseci
                          <select name="months" defaultValue="1" className="admin-input text-sm">
                            {[1, 3, 6, 12].map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="submit" className="rounded-full bg-black text-white text-xs font-semibold px-4 py-2">
                          Aktiviraj paket
                        </button>
                      </form>
                      <form action={extendTrialAction} className="flex items-end gap-2">
                        <input type="hidden" name="orgId" value={r.id} />
                        <input type="hidden" name="days" value="14" />
                        <button
                          type="submit"
                          className="text-xs font-semibold px-4 py-2 rounded-full border border-black/15 hover:border-black/40"
                        >
                          Proba +14 dana
                        </button>
                      </form>
                      {r.active && (
                        <form action={deactivateAction} className="flex items-end gap-2">
                          <input type="hidden" name="orgId" value={r.id} />
                          <button
                            type="submit"
                            className="text-xs font-semibold px-4 py-2 rounded-full border border-[#d70015]/30 text-[#b80012] hover:border-[#d70015]/60"
                          >
                            Ugasi
                          </button>
                        </form>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-black/45">
                      Aktivacija vrijedi od danas. Nakon isteka slanje SMS-a staje samo od sebe. Gašenje zaustavlja slanje odmah,
                      a podaci tvrtke ostaju.
                    </p>
                  </details>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
