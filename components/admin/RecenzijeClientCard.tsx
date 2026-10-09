import RecenzijeClientDetailsForm from "@/components/admin/RecenzijeClientDetailsForm";
import RecenzijeConfirmButton from "@/components/admin/RecenzijeConfirmButton";
import {
  activatePlanAction,
  changePlanAction,
  deactivateAction,
  extendFreePeriodAction,
  openWorkspaceAction,
} from "@/lib/recenzije/actions/novo-admin";
import { formatAdminDate, type AdminOrgRow, type AdminOrgState } from "@/lib/recenzije/services/novo-admin";
import { estimateTwilioCostUsd, formatUsd, TWILIO_HR_USD_PER_SEGMENT } from "@/lib/recenzije/sms-format";

/**
 * Kartica jednog klijenta u /admin/recenzije: tko je, što je platio (ili je besplatno), koliko
 * je poslano, je li spreman za slanje i što NOVO tim može napraviti (otvoriti radni prostor,
 * promijeniti paket, urediti kontakt). Server komponenta: radnje su server akcije koje
 * ponovno provjeravaju da je admin glavni admin.
 */

export type CardPlan = { key: string; name: string; priceMonthlyCents: number; smsMonthlyLimit: number };

const STATE: Record<AdminOrgState, { label: string; cls: string }> = {
  active: { label: "Aktivan", cls: "bg-[#0b7a3e]/10 text-[#0b7a3e]" },
  free_period: { label: "Besplatno razdoblje", cls: "bg-[#0000c3]/10 text-[#0000c3]" },
  free_expired: { label: "Besplatno razdoblje isteklo", cls: "bg-[#ff7f00]/12 text-[#9a4a00]" },
  expired: { label: "Paket istekao", cls: "bg-[#ff7f00]/12 text-[#9a4a00]" },
  inactive: { label: "Neaktivan", cls: "bg-black/5 text-black/55" },
};

function daysFrom(d: Date | string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

export function eur(cents: number) {
  return (cents / 100).toLocaleString("hr-HR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function endsLabel(r: AdminOrgRow) {
  if (!r.endsAt) return "—";
  const left = daysFrom(r.endsAt);
  const when = formatAdminDate(r.endsAt);
  const rest = left != null && left >= 0 ? ` (još ${left} d)` : "";
  switch (r.state) {
    case "active":
      return `${r.viaStripe ? "Obnova" : "Plaćeno"} do ${when}${rest}`;
    case "free_period":
      return `Besplatno do ${when}${rest}`;
    case "free_expired":
    case "expired":
      return `Isteklo ${when}`;
    default:
      return `Ugašeno ${when}`;
  }
}

function Pill({ ok, label, missing }: { ok: boolean; label: string; missing?: string }) {
  return (
    <span
      className={
        "text-[11px] font-semibold px-2 py-0.5 rounded-full " +
        (ok ? "bg-[#0b7a3e]/10 text-[#0b7a3e]" : "bg-[#ff7f00]/12 text-[#9a4a00]")
      }
    >
      {ok ? label : `${label}: ${missing ?? "fali"}`}
    </span>
  );
}

function PlanOptions({ plans }: { plans: CardPlan[] }) {
  return (
    <>
      {plans.map((p) => (
        <option key={p.key} value={p.key}>
          {p.name} · {eur(p.priceMonthlyCents)} € · {p.smsMonthlyLimit} SMS
        </option>
      ))}
    </>
  );
}

const panel = "rounded-xl border border-black/10 p-3 flex flex-col gap-2 min-w-0";
const label = "flex flex-col gap-1 text-xs text-black/60 min-w-0";
const primaryBtn = "rounded-full bg-black text-white text-xs font-semibold px-4 py-2 self-start";

export default function RecenzijeClientCard({
  row: r,
  plans,
  smsReady,
  smsProvider,
  flash,
}: {
  row: AdminOrgRow;
  plans: CardPlan[];
  /** Je li SMS pošiljatelj (Twilio, TextBee ili NOVO mobitel) postavljen; null kad se status nije mogao pročitati. */
  smsReady: boolean | null;
  /** Aktivni pružatelj; procjena troška u USD prikazuje se samo uz Twilio (TextBee ide po tarifi SIM-a). */
  smsProvider: "twilio" | "textbee" | "novo" | "none" | null;
  flash: { kind: "ok" | "error"; text: string } | null;
}) {
  const st = STATE[r.state];
  const pct = Math.min(100, Math.round((r.smsThisMonth / Math.max(1, r.smsLimit)) * 100));
  const hasPlan = !!r.sub && r.sub.planKey !== "trial" && !!r.planName;
  const currentPlanKey = hasPlan ? r.sub!.planKey : (plans[0]?.key ?? "");

  const contactEmail = r.contactEmail ?? r.ownerEmail;
  const contactName = r.contactName ?? r.ownerName;
  const hasContact = !!(r.contactEmail || r.contactName || r.contactPhone);

  const missing: string[] = [];
  if (!r.hasReviewUrl) missing.push("Google link");
  if (!r.active) missing.push("aktivan paket");
  if (smsReady !== true) missing.push("SMS pošiljatelj");
  const ready = missing.length === 0;

  return (
    <article id={`klijent-${r.id}`} className="neu-card px-4 py-4 flex flex-col gap-4 scroll-mt-20">
      <div className="flex items-start justify-between gap-x-4 gap-y-2 flex-wrap">
        <div className="min-w-0">
          <div className="font-semibold flex items-center gap-2 flex-wrap break-words">
            {r.name}
            <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + st.cls}>{st.label}</span>
            {r.viaStripe && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/5 text-black/55">Stripe</span>
            )}
          </div>
          <div className="text-xs text-black/55 mt-0.5 break-words">
            {r.industry ? `${r.industry} · ` : ""}dodan {formatAdminDate(r.createdAt)}
          </div>
        </div>
        <div className="text-xs sm:text-right min-w-0">
          <div className="font-semibold text-sm">
            {hasPlan ? `${r.planName} · ${eur(r.planPriceCents ?? 0)} €/mj` : "Bez paketa"}
          </div>
          <div className="text-black/55">{endsLabel(r)}</div>
        </div>
      </div>

      {flash && (
        <div
          role={flash.kind === "ok" ? "status" : "alert"}
          className={
            "rounded-xl border px-3.5 py-2 text-sm break-words " +
            (flash.kind === "ok"
              ? "border-[#0b7a3e]/30 bg-[#0b7a3e]/5"
              : "border-[#d70015]/30 bg-[#d70015]/5 text-[#b80012]")
          }
        >
          {flash.kind === "ok" ? `Spremljeno · ${flash.text}` : flash.text}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 text-xs">
        <div className="min-w-0">
          <div className="text-black/45 uppercase tracking-wide text-[10px] font-semibold mb-0.5">Kontakt</div>
          {hasContact || contactEmail ? (
            <div className="break-words">
              {contactName && <div className="font-semibold text-sm">{contactName}</div>}
              {contactEmail && (
                <a href={`mailto:${contactEmail}`} className="underline decoration-black/20 block break-all">
                  {contactEmail}
                </a>
              )}
              {r.contactPhone && (
                <a href={`tel:${r.contactPhone}`} className="underline decoration-black/20 block">
                  {r.contactPhone}
                </a>
              )}
              {!r.contactEmail && contactEmail && (
                <div className="text-[#9a4a00] mt-0.5">Stari račun: upišite kontakt ispod da izvještaj ide na pravi email.</div>
              )}
            </div>
          ) : (
            <div className="text-[#9a4a00]">Kontakt nije upisan, pa tjedni izvještaj ne ide nikamo. Upišite ga ispod.</div>
          )}
        </div>
        {r.internalNote && (
          <div className="min-w-0">
            <div className="text-black/45 uppercase tracking-wide text-[10px] font-semibold mb-0.5">Bilješka</div>
            <div className="text-black/70 whitespace-pre-line break-words line-clamp-3">{r.internalNote}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-xs">
        <div className="col-span-2">
          <div className="flex justify-between gap-2 text-black/55">
            <span>SMS ovaj mjesec</span>
            <span className="tabular-nums font-semibold text-black">
              {r.smsThisMonth}/{r.smsLimit}
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-black/5 rounded-full overflow-hidden" role="img" aria-label={`Iskorišteno ${pct}% mjesečnog limita SMS-ova`}>
            <div className={"h-full rounded-full " + (pct > 90 ? "bg-[#d70015]" : "bg-[#ff7f00]")} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div>
          <span className="text-black/55">Kupaca u bazi </span>
          <b className="tabular-nums">{r.clients}</b>
        </div>
        <div>
          <span className="text-black/55">Recenzija </span>
          <b className="tabular-nums">{r.reviews}</b>
        </div>
        <div className="col-span-2">
          <span className="text-black/55">Zadnja poruka </span>
          <b>{r.lastMessageAt ? formatAdminDate(r.lastMessageAt) : "još nijedna"}</b>
        </div>
        <div className="col-span-2">
          <span className="text-black/55">Neuspjeli SMS (30 d) </span>
          <b className={"tabular-nums " + (r.failed30d > 0 ? "text-[#b80012]" : "")}>{r.failed30d}</b>
        </div>
        {smsProvider === "textbee" && (
          <div className="col-span-2 sm:col-span-4 text-[11px] text-black/55 break-words">
            Trošak SMS-a (TextBee): <b className="text-black">po tarifi vašeg SIM-a</b>. Poruke odlaze s vašeg mobitela, pa nema cijene po poruci u
            USD.
          </div>
        )}
        {smsProvider === "twilio" && (
          <div className="col-span-2 sm:col-span-4 text-[11px] text-black/55 break-words">
            Procjena troška (Twilio): <b className="text-black tabular-nums">{formatUsd(estimateTwilioCostUsd(r.twilioSegmentsThisMonth))}</b> ovaj mjesec (
            {r.twilioSegmentsThisMonth} segm. × {TWILIO_HR_USD_PER_SEGMENT.toLocaleString("hr-HR", { minimumFractionDigits: 3 })} USD). Pun limit od {r.smsLimit} SMS ≈{" "}
            {formatUsd(estimateTwilioCostUsd(r.smsLimit))} do {formatUsd(estimateTwilioCostUsd(r.smsLimit * 2))} (1 do 2 segmenta po poruci). Okvirno, stvarni trošak je na
            Twilio računu.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-semibold">
          Spremno za slanje:{" "}
          <span className={ready ? "text-[#0b7a3e]" : "text-[#9a4a00]"}>{ready ? "da" : `ne, fali ${missing.join(", ")}`}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill ok={r.hasReviewUrl} label="Google link" />
          <Pill ok={r.active} label="Aktivan paket" />
          <Pill ok={smsReady === true} label="SMS pošiljatelj" missing={smsReady === null ? "status nepoznat" : "nije postavljen"} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={openWorkspaceAction}>
          <input type="hidden" name="orgId" value={r.id} />
          <button type="submit" className="rounded-full bg-black text-white text-xs font-semibold px-4 py-2">
            Otvori radni prostor
          </button>
        </form>
        <span className="text-[11px] text-black/45">Klijenti, slanje, poruke i recenzije za {r.name}.</span>
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-black/70 hover:text-black list-none inline-flex items-center gap-1">
          <span className="transition-transform group-open:rotate-90">›</span> Kontakt i bilješka
        </summary>
        <div className="mt-3">
          <RecenzijeClientDetailsForm
            defaults={{
              orgId: r.id,
              contactName: contactName ?? "",
              contactEmail: contactEmail ?? "",
              contactPhone: r.contactPhone ?? "",
              internalNote: r.internalNote ?? "",
            }}
          />
        </div>
      </details>

      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-black/70 hover:text-black list-none inline-flex items-center gap-1">
          <span className="transition-transform group-open:rotate-90">›</span> Paket i plaćanje
        </summary>
        {r.viaStripe ? (
          <p className="mt-3 text-xs text-black/50">Plaća preko Stripea: paket i otkaz mijenjaju se u Stripeu.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <form action={extendFreePeriodAction} className={panel}>
                <input type="hidden" name="orgId" value={r.id} />
                <div className="text-xs font-semibold">Besplatno razdoblje</div>
                <label className={label}>
                  Paket
                  <select name="planKey" defaultValue={currentPlanKey} className="admin-input text-sm">
                    <PlanOptions plans={plans} />
                  </select>
                </label>
                <label className={label}>
                  Dani (1 do 90)
                  <input name="days" type="number" inputMode="numeric" min={1} max={90} defaultValue={14} className="admin-input text-sm" />
                </label>
                <button type="submit" className={primaryBtn}>
                  Dodaj besplatne dane
                </button>
              </form>

              <form action={activatePlanAction} className={panel}>
                <input type="hidden" name="orgId" value={r.id} />
                <div className="text-xs font-semibold">Plaćeni paket</div>
                <label className={label}>
                  Paket
                  <select name="planKey" defaultValue={currentPlanKey} className="admin-input text-sm">
                    <PlanOptions plans={plans} />
                  </select>
                </label>
                <label className={label}>
                  Mjeseci (od danas)
                  <select name="months" defaultValue="1" className="admin-input text-sm">
                    {[1, 3, 6, 12].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className={primaryBtn}>
                  Aktiviraj plaćeno
                </button>
              </form>

              <form action={changePlanAction} className={panel}>
                <input type="hidden" name="orgId" value={r.id} />
                <div className="text-xs font-semibold">Promjena paketa</div>
                <label className={label}>
                  Novi paket
                  <select name="planKey" defaultValue={currentPlanKey} className="admin-input text-sm">
                    <PlanOptions plans={plans} />
                  </select>
                </label>
                <p className="text-[11px] text-black/45">Rok ostaje isti, mijenja se samo paket i SMS limit.</p>
                <button type="submit" className="text-xs font-semibold px-4 py-2 rounded-full border border-black/15 hover:border-black/40 self-start">
                  Promijeni paket
                </button>
              </form>
            </div>

            {r.active && (
              <div>
                <RecenzijeConfirmButton
                  action={deactivateAction}
                  orgId={r.id}
                  title={`Ugasiti paket za ${r.name}?`}
                  description="Slanje SMS-ova staje odmah. Podaci klijenta ostaju i paket se može ponovno aktivirati."
                  buttonLabel="Ugasi"
                  confirmLabel="Ugasi paket"
                  pendingLabel="Gasim…"
                />
              </div>
            )}
            <p className="text-[11px] text-black/45">
              Besplatni dani se dodaju na kraj razdoblja koje već traje. Nakon isteka slanje staje samo od sebe. Plaćeni mjeseci računaju se od danas.
            </p>
          </div>
        )}
      </details>
    </article>
  );
}
