"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Ban, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { sendBulkRequestsAction, sendReviewRequestAction } from "@/lib/recenzije/actions/clients";
import { Button } from "@/components/recenzije/ui/button";
import { Avatar, Badge, hitArea } from "@/components/recenzije/ui/primitives";
import { formatPhone } from "@/lib/recenzije/phone";
import { formatDate, REVIEW_STATUS, timeAgo } from "@/lib/recenzije/status";
import { cn } from "@/lib/recenzije/utils";
import type { ReviewStatus } from "@/lib/recenzije/db/schema";

export type ClientTableRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  reviewStatus: ReviewStatus;
  smsOptOut: boolean;
  /** 'menu' = gost s jelovnika (privola vrijedi samo za jednu poruku koju šalje automatizacija). */
  source?: string | null;
  lastMessageAt: Date | null;
  nextFollowUpAt: Date | null;
  service: string | null;
  technician: string | null;
  serviceDate: Date | null;
};

function SortHeader({ label, col, className }: { label: string; col: string; className?: string }) {
  const sp = useSearchParams();
  const path = usePathname();
  const current = sp.get("sort") ?? "created";
  const dir = sp.get("dir") ?? "desc";
  const active = current === col;
  const next = new URLSearchParams(sp.toString());
  next.set("sort", col);
  next.set("dir", active && dir === "desc" ? "asc" : "desc");
  next.delete("page");
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th scope="col" className={cn("px-4 py-3 text-left font-normal", className)} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={`${path}?${next}`} scroll={false} className={cn(hitArea, "inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {label}
        <Icon className="size-3.5 opacity-70" />
      </Link>
    </th>
  );
}

function StatusCell({ row }: { row: ClientTableRow }) {
  const st = REVIEW_STATUS[row.reviewStatus];
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={st.tone} dot>
        {st.label}
      </Badge>
      {row.reviewStatus === "FOLLOW_UP_SCHEDULED" && row.nextFollowUpAt && (
        <span className="text-[11px] text-subtle">{timeAgo(row.nextFollowUpAt)}</span>
      )}
    </div>
  );
}

function SendButton({ row, compact }: { row: ClientTableRow; compact?: boolean }) {
  const [pending, start] = useTransition();
  if (row.smsOptOut) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-subtle" title="Klijent se odjavio od SMS-ova (odgovor STOP ili poveznica za odjavu)">
        <Ban className="size-3.5" /> Odjavljen
      </span>
    );
  }
  if (row.reviewStatus === "REVIEW_RECEIVED" || row.reviewStatus === "COMPLETED") return null;
  // Gost s jelovnika bez usluge: ručno slanje je isključeno (poslužitelj ga ionako odbija), pa gumb ne nudimo.
  if (row.source === "menu" && !row.service) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-subtle"
        title="Gost s jelovnika pristao je samo na jednu poruku s molbom za recenziju, koju šalje automatizacija jelovnika."
      >
        Gost jelovnika
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await sendReviewRequestAction(row.id);
          if (r.ok) toast.success(r.message);
          else toast.error(r.error ?? "Poruka nije poslana");
        });
      }}
      aria-label={`Pošalji zahtjev za recenziju: ${row.firstName}`}
    >
      {!pending && <Send />}
      {compact ? (
        "Pošalji"
      ) : (
        <>
          {/* Dugi naziv tek na xl: na tabletu i uskom laptopu tablica inače prelazi širinu kartice i gumb se odreže. */}
          <span className="xl:hidden">Pošalji</span>
          <span className="hidden xl:inline">{row.reviewStatus === "NOT_CONTACTED" ? "Pošalji zahtjev" : "Pošalji opet"}</span>
        </>
      )}
    </Button>
  );
}

export function ClientsTable({ rows }: { rows: ClientTableRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-y border-foreground bg-orange-soft px-4 py-2.5 text-sm">
          <span className="font-bold">Odabrano: {selected.size}</span>
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await sendBulkRequestsAction([...selected]);
                if (r.ok) {
                  toast.success(r.message);
                  setSelected(new Set());
                } else toast.error(r.error ?? "Poruke nisu poslane");
              })
            }
          >
            <Send /> Pošalji zahtjeve
          </Button>
          <button type="button" className="text-muted hover:text-foreground" onClick={() => setSelected(new Set())}>
            Očisti
          </button>
        </div>
      )}

      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="label border-y border-border bg-surface-2 text-muted">
            <tr>
              <th className="w-10 px-4 py-3">
                <label className="-m-3 grid size-10 cursor-pointer place-items-center">
                  <input
                    type="checkbox"
                    aria-label="Odaberi sve"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="size-4 accent-black"
                  />
                </label>
              </th>
              <SortHeader label="Klijent" col="name" />
              <th scope="col" className="px-4 py-3 text-left font-normal">Usluga</th>
              <SortHeader label="Datum usluge" col="service_date" className="hidden min-[1120px]:table-cell" />
              <SortHeader label="Status" col="status" />
              <SortHeader label="Zadnja poruka" col="last_message" className="hidden xl:table-cell" />
              <th className="px-4 py-3">
                <span className="sr-only">Radnje</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className={cn("group hover:bg-surface-2/50", selected.has(r.id) && "bg-orange-soft")}>
                <td className="px-4 py-3">
                  <label className="-m-3 grid size-10 cursor-pointer place-items-center">
                    <input
                      type="checkbox"
                      aria-label={`Odaberi ${r.firstName} ${r.lastName}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="size-4 accent-black"
                    />
                  </label>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/recenzije/klijenti/${r.id}`} className="-my-1 flex items-center gap-3 py-1">
                    <Avatar name={`${r.firstName} ${r.lastName}`} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-hover:underline">
                        {r.firstName} {r.lastName}
                      </span>
                      <span className="tabular block text-xs text-muted">{formatPhone(r.phone)}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{r.service ?? <span className="text-subtle">—</span>}</span>
                  {r.technician && <span className="block text-xs text-muted">{r.technician}</span>}
                </td>
                <td className="tabular hidden px-4 py-3 text-muted min-[1120px]:table-cell">{formatDate(r.serviceDate)}</td>
                <td className="px-4 py-3">
                  <StatusCell row={r} />
                </td>
                <td className="hidden px-4 py-3 text-muted xl:table-cell">{timeAgo(r.lastMessageAt)}</td>
                <td className="px-4 py-3 text-right">
                  <SendButton row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-border border-t border-border md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3.5">
            {/* Oznaka 40x40px daje dovoljno područje dodira, a kvadratić ostaje 16px na istom mjestu. */}
            <label className="-ml-3 grid size-10 shrink-0 cursor-pointer place-items-center">
              <input
                type="checkbox"
                aria-label={`Odaberi ${r.firstName} ${r.lastName}`}
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                className="size-4 accent-black"
              />
            </label>
            <Link href={`/recenzije/klijenti/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={`${r.firstName} ${r.lastName}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {r.firstName} {r.lastName}
                </span>
                <span className="block truncate text-xs text-muted">
                  {r.service ?? "Bez usluge"} · {formatDate(r.serviceDate)}
                </span>
                <span className="mt-1.5 block">
                  <StatusCell row={r} />
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
