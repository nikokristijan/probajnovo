"use client";

import { useMemo, useState } from "react";
import DeleteSaleButton from "@/components/admin/DeleteSaleButton";
import type { Sale } from "@/lib/db/schema";

const CATEGORY_LABELS: Record<string, string> = {
  stranica: "Izrada stranice",
  proizvod: "Proizvod",
  konzultacija: "Konzultacija",
  ostalo: "Ostalo",
};

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });
}

/** Tablica prodaja s pretragom po stavci/kupcu i filterom po kategoriji —
    isti obrazac kao ReservationsTable za vikendice. */
export default function SalesTable({ sales }: { sales: Sale[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (category && s.category !== category) return false;
      if (q && !s.item.toLowerCase().includes(q) && !(s.buyerName ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sales, search, category]);

  if (sales.length === 0) {
    return <p className="text-sm text-black/60">Još nema unesenih prodaja.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pretraži po stavci ili kupcu…"
          className="admin-input max-w-xs"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="admin-input max-w-[180px]">
          <option value="">Sve kategorije</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/60">Nema prodaja koje odgovaraju pretrazi.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10 rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/10">
                <th className="px-4 py-2.5 font-semibold">Datum</th>
                <th className="px-4 py-2.5 font-semibold">Kategorija</th>
                <th className="px-4 py-2.5 font-semibold">Stavka</th>
                <th className="px-4 py-2.5 font-semibold">Kupac</th>
                <th className="px-4 py-2.5 font-semibold">Cijena</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#0000c3]/10 text-[#0000c3]">
                      {CATEGORY_LABELS[s.category] ?? s.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {s.item}
                    {s.note && <div className="mt-1 text-xs text-black/50 font-normal whitespace-pre-wrap">{s.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-black/60">{s.buyerName ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{s.priceEur} €</td>
                  <td className="px-4 py-3 text-right">
                    <DeleteSaleButton id={s.id} item={s.item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
