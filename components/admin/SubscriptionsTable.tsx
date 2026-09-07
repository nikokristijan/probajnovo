"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { extendSubscriptionAction } from "@/lib/actions";
import DeleteSubscriptionButton from "@/components/admin/DeleteSubscriptionButton";
import type { Subscription } from "@/lib/db/schema";

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

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });
}

/**
 * Tablica NOVO-ovih pretplata (Financije) — pretraga po klijentu, filter po
 * statusu, "ističe uskoro" (unutar 7 dana ili već prošlo) istaknuto crveno/
 * narančasto (isti duh kao "Nadolazi/U tijeku/Završeno" u ReservationsTable).
 * `today` mora doći iz todayDateStringZagreb() (vidi lib/date.ts).
 */
export default function SubscriptionsTable({
  subscriptions,
  today,
}: {
  subscriptions: Subscription[];
  today: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const cutoff7 = useMemo(() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscriptions.filter((s) => {
      if (status && s.status !== status) return false;
      if (q && !s.sourceName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subscriptions, search, status]);

  if (subscriptions.length === 0) {
    return <p className="text-sm text-black/60">Još nema unesenih pretplata.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pretraži po klijentu…"
          className="admin-input max-w-xs"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-input max-w-[180px]">
          <option value="">Svi statusi</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/60">Nema pretplata koje odgovaraju pretrazi.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10 rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/10">
                <th className="px-4 py-2.5 font-semibold">Klijent</th>
                <th className="px-4 py-2.5 font-semibold">Cijena/mj</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Start</th>
                <th className="px-4 py-2.5 font-semibold">Sljedeća naplata</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const isExpiringSoon =
                  (s.status === "active" || s.status === "trial") && s.nextRenewalDate <= cutoff7;
                const isOverdue = isExpiringSoon && s.nextRenewalDate < today;
                return (
                  <tr key={s.id} className="border-b border-black/5 last:border-0 align-top">
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {s.sourceName}
                      <span className="ml-1.5 text-xs font-normal text-black/40">
                        {s.source === "property" ? "🏠" : "🏢"}
                      </span>
                      {s.note && <div className="mt-1 text-xs text-black/50 font-normal whitespace-pre-wrap">{s.note}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{s.monthlyPriceEur} €</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={"text-[11px] font-semibold px-2.5 py-1 rounded-full " + STATUS_CLASSES[s.status]}
                      >
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.startDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          isOverdue
                            ? "font-semibold text-red-600"
                            : isExpiringSoon
                            ? "font-semibold text-[#ff7f00]"
                            : ""
                        }
                      >
                        {formatDate(s.nextRenewalDate)}
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
