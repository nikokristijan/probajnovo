"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { extendSubscriptionAction } from "@/lib/actions";
import DeleteSubscriptionButton from "@/components/admin/DeleteSubscriptionButton";
import DeleteSaleButton from "@/components/admin/DeleteSaleButton";
import type { Subscription, Sale } from "@/lib/db/schema";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktivna",
  trial: "Probni period",
  paused: "Pauzirana",
  cancelled: "Otkazana",
};
const STATUS_CLASSES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-[#0000c3]/10 text-[#0000c3]",
  paused: "bg-black/5 text-black/50",
  cancelled: "bg-red-50 text-red-600",
};
const SALE_CATEGORY_LABELS: Record<string, string> = {
  stranica: "Izrada stranice",
  proizvod: "Proizvod",
  konzultacija: "Konzultacija",
  ostalo: "Ostalo",
};

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });
}

/** Zajednički oblik retka — pretplata i prodaja imaju potpuno različita
 * polja u bazi (vidi lib/db/schema.ts subscriptions/sales), pa se ovdje
 * normaliziraju u jedan zajednički "red" da mogu sjediti u ISTOJ tablici i
 * ISTOM kronološkom poretku (vidi napomenu o "sortDate" niže). */
type LedgerRow =
  | { kind: "pretplata"; sortDate: string; data: Subscription }
  | { kind: "prodaja"; sortDate: string; data: Sale };

/**
 * Spojeni "Financije" pregled — vidi app/admin/financije. Pretplate
 * (ponavljajuća NOVO-ova naplata klijentima) i prodaje (jednokratna zarada
 * agencije) su u bazi dvije potpuno odvojene tablice s različitim poljima,
 * ali korisnik je eksplicitno tražio "pravo spajanje u jednu tablicu" umjesto
 * dvije odvojene sekcije — ovdje se stoga normaliziraju u ISTI red (`kind`
 * razlikuje tip, `sortDate` je zajednička kronološka os: startDate za
 * pretplate, date za prodaje — obje predstavljaju "kad je ovo ušlo u
 * knjige", za razliku od npr. nextRenewalDate koji gleda unaprijed).
 */
export default function AgencyLedgerTable({
  subscriptions,
  sales,
  today,
}: {
  subscriptions: Subscription[];
  sales: Sale[];
  today: string;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | "pretplata" | "prodaja">("");

  const cutoff7 = useMemo(() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const rows: LedgerRow[] = useMemo(() => {
    const subRows: LedgerRow[] = subscriptions.map((s) => ({
      kind: "pretplata",
      sortDate: s.startDate,
      data: s,
    }));
    const saleRows: LedgerRow[] = sales.map((s) => ({ kind: "prodaja", sortDate: s.date, data: s }));
    return [...subRows, ...saleRows].sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1));
  }, [subscriptions, sales]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (type && r.kind !== type) return false;
      if (!q) return true;
      if (r.kind === "pretplata") return r.data.sourceName.toLowerCase().includes(q);
      return (
        r.data.item.toLowerCase().includes(q) || (r.data.buyerName ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, type]);

  if (rows.length === 0) {
    return <p className="text-sm text-black/60">Još nema unesenih pretplata ni prodaja.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pretraži po klijentu, stavci ili kupcu…"
          className="admin-input max-w-xs"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "" | "pretplata" | "prodaja")}
          className="admin-input max-w-[180px]"
        >
          <option value="">Sve (pretplate + prodaje)</option>
          <option value="pretplata">Samo pretplate</option>
          <option value="prodaja">Samo prodaje</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/60">Nema stavki koje odgovaraju pretrazi.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10 rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/10">
                <th className="px-4 py-2.5 font-semibold">Tip</th>
                <th className="px-4 py-2.5 font-semibold">Klijent / stavka</th>
                <th className="px-4 py-2.5 font-semibold">Iznos</th>
                <th className="px-4 py-2.5 font-semibold">Status / kategorija</th>
                <th className="px-4 py-2.5 font-semibold">Datum</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                if (r.kind === "pretplata") {
                  const s = r.data;
                  const isExpiringSoon =
                    (s.status === "active" || s.status === "trial") && s.nextRenewalDate <= cutoff7;
                  const isOverdue = isExpiringSoon && s.nextRenewalDate < today;
                  return (
                    <tr key={`sub-${s.id}`} className="border-b border-black/5 last:border-0 align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#0000c3]/10 text-[#0000c3]">
                          Pretplata
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        {s.sourceName}
                        <span className="ml-1.5 text-xs font-normal text-black/40">
                          {s.source === "property" ? "🏠" : "🏢"}
                        </span>
                        {s.note && (
                          <div className="mt-1 text-xs text-black/50 font-normal whitespace-pre-wrap">
                            {s.note}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{s.monthlyPriceEur} €/mj</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={"text-[11px] font-semibold px-2.5 py-1 rounded-full " + STATUS_CLASSES[s.status]}
                        >
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                        {isExpiringSoon && (
                          <div className="mt-1">
                            <form action={extendSubscriptionAction.bind(null, s.id, 1)}>
                              <button
                                type="submit"
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black text-white"
                              >
                                Produži 1 mj.
                              </button>
                            </form>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={isOverdue ? "font-semibold text-red-600" : ""}>
                          {formatDate(s.startDate)}
                        </span>
                        <div className="mt-0.5 text-xs text-black/40">
                          sljedeća naplata {formatDate(s.nextRenewalDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/financije/${s.id}`}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
                          >
                            Uredi
                          </Link>
                          <DeleteSubscriptionButton id={s.id} name={s.sourceName} />
                        </div>
                      </td>
                    </tr>
                  );
                }

                const s = r.data;
                return (
                  <tr key={`sale-${s.id}`} className="border-b border-black/5 last:border-0 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#ff7f00]/10 text-[#ff7f00]">
                        Prodaja
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {s.item}
                      {s.buyerName && <span className="ml-1.5 text-xs font-normal text-black/40">{s.buyerName}</span>}
                      {s.note && (
                        <div className="mt-1 text-xs text-black/50 font-normal whitespace-pre-wrap">{s.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{s.priceEur} €</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black/5 text-black/60">
                        {SALE_CATEGORY_LABELS[s.category] ?? s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.date)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <DeleteSaleButton id={s.id} item={s.item} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
