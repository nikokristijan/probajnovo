import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import RecenzijeClientCard, { eur } from "@/components/admin/RecenzijeClientCard";
import RecenzijeNewClientForm, { type PlanOption } from "@/components/admin/RecenzijeNewClientForm";
import RecenzijeSmsCard, { type SmsSenderView } from "@/components/admin/RecenzijeSmsCard";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatCard } from "@/components/admin/StatCard";
import { openDemoAction } from "@/lib/recenzije/actions/novo-admin";
import { type AdminVenueInfo, getAdminVenueInfo } from "@/lib/recenzije/services/admin-venues";
import { listOrganizationsForNovoAdmin, listPlansForNovoAdmin, summarize } from "@/lib/recenzije/services/novo-admin";
import { getSmsSenderStatus } from "@/lib/recenzije/services/sms-status";

export const dynamic = "force-dynamic";

/**
 * NOVO Recenzije kao usluga: ovdje NOVO tim vodi klijente. Klijent nema prijavu ni obveza,
 * a tim za svakog otvara tvrtku, postavlja je u pravoj aplikaciji ("Otvori radni prostor") i
 * šalje preko jednog zajedničkog SMS pošiljatelja (Twilio, TextBee s vlastitog mobitela ili neobavezni NOVO Android mobitel). Besplatno razdoblje daje se po klijentu. Demo
 * tvrtka je izostavljena. Isti uvjet pristupa kao Financije (samo glavni admin).
 */

/** Status SMS pošiljatelja dolazi iz env varijabli; ako čitanje ne uspije, stranica i dalje radi. */
function readSms(): SmsSenderView {
  try {
    return { available: true, status: getSmsSenderStatus() };
  } catch (e) {
    return { available: false, error: e instanceof Error ? e.message.slice(0, 300) : "Nepoznata greška." };
  }
}

/**
 * Vrsta poslovanja i brojke jelovnika dolaze iz zasebnog upita. Ako čitanje ne uspije, stranica i dalje radi, ali tada
 * kartice NE nude promjenu vrste poslovanja (prazna karta = nepoznato), da spremanje kontakta ništa ne prebriše.
 */
async function readVenues(ids: string[]): Promise<Map<string, AdminVenueInfo> | null> {
  try {
    return await getAdminVenueInfo(ids);
  } catch (e) {
    console.error("[recenzije] admin: podaci o ugostiteljstvu", e);
    return null;
  }
}

export default async function AdminRecenzijePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; greska?: string; k?: string }>;
}) {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (!admin.isSuperAdmin) redirect("/admin");

  const sp = await searchParams;
  const [rows, plans] = await Promise.all([listOrganizationsForNovoAdmin(), listPlansForNovoAdmin()]);
  const sum = summarize(rows);
  const venues = await readVenues(rows.map((r) => r.id));
  const sms = readSms();

  const planOptions: PlanOption[] = plans.map((p) => ({
    key: p.key,
    name: p.name,
    priceLabel: `${eur(p.priceMonthlyCents)} €/mj`,
    smsLimit: p.smsMonthlyLimit,
  }));

  // Poruka o radnji nad klijentom prikazuje se uz njegovu karticu; inače na vrhu.
  const flashText = sp.ok ?? sp.greska ?? null;
  const flashKind: "ok" | "error" = sp.ok ? "ok" : "error";
  const flashClientId = sp.k && rows.some((r) => r.id === sp.k) ? sp.k : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Recenzije</h1>
          <p className="text-xs text-black/50 mt-0.5 max-w-[60ch]">
            Usluga koju vodi NOVO: klijent plaća, a vi sve postavljate i šaljete za njega. Klijent nema prijavu ni obveza. Vidljivo samo glavnom adminu.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Link
            href="/recenzije"
            target="_blank"
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
          >
            Stranica proizvoda ↗
          </Link>
          <form action={openDemoAction}>
            <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40">
              Otvori demo
            </button>
          </form>
        </div>
      </div>

      {flashText && !flashClientId && (
        <div
          role={flashKind === "ok" ? "status" : "alert"}
          className={
            "rounded-xl border px-4 py-2.5 text-sm break-words " +
            (flashKind === "ok"
              ? "border-[#0b7a3e]/30 bg-[#0b7a3e]/5"
              : "border-[#d70015]/30 bg-[#d70015]/5 text-[#b80012]")
          }
        >
          {flashKind === "ok" ? `Spremljeno · ${flashText}` : flashText}
        </div>
      )}

      <RecenzijeSmsCard sms={sms} />

      <section className="admin-animate-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Klijenti" value={sum.total} />
        <StatCard label="Plaćaju" value={sum.paying} />
        <StatCard label="Besplatno razdoblje" value={sum.freePeriod} />
        <StatCard label="Neaktivni" value={sum.lapsed} />
        <StatCard label="MRR (bez PDV-a)" value={Math.round(sum.mrrCents / 100)} suffix=" €" />
        <StatCard label="SMS u 30 dana" value={sum.sms30d} />
      </section>

      <RecenzijeNewClientForm plans={planOptions} defaultOpen={rows.length === 0} />

      {rows.length === 0 ? (
        <EmptyState title="Još nema klijenata. Dodajte prvog." hint="Upišite tvrtku i kontakt, odaberite paket i otvorite radni prostor." />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">Klijenti ({rows.length})</h2>
          {rows.map((r) => (
            <RecenzijeClientCard
              key={r.id}
              row={r}
              plans={plans}
              flash={flashText && flashClientId === r.id ? { kind: flashKind, text: flashText } : null}
              venue={venues?.get(r.id) ?? null}
            />
          ))}
        </section>
      )}
    </div>
  );
}
