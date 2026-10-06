"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input, Select } from "@/components/recenzije/ui/primitives";
import { REVIEW_STATUS, REVIEW_STATUS_ORDER } from "@/lib/recenzije/status";

export function ClientFilters({ services, technicians }: { services: string[]; technicians: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["status", "service", "technician", "q"].some((k) => sp.get(k));

  return (
    <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          id="client-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Traži ime, mobitel ili email"
          className="pl-9"
          aria-label="Traži klijente"
          type="search"
        />
        {pending && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle" />}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex">
        <Select id="f-status" aria-label="Filtriraj po statusu" value={sp.get("status") ?? ""} onChange={(e) => update({ status: e.target.value })} className="md:w-44">
          <option value="">Svi statusi</option>
          {REVIEW_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {REVIEW_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select id="f-service" aria-label="Filtriraj po usluzi" value={sp.get("service") ?? ""} onChange={(e) => update({ service: e.target.value })} className="md:w-44">
          <option value="">Sve usluge</option>
          {services.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select
          id="f-tech"
          aria-label="Filtriraj po serviseru"
          value={sp.get("technician") ?? ""}
          onChange={(e) => update({ technician: e.target.value })}
          className="col-span-2 sm:col-span-1 md:w-44"
        >
          <option value="">Svi serviseri</option>
          {technicians.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </div>
      {active && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            start(() => router.replace(pathname, { scroll: false }));
          }}
          className="label inline-flex h-11 items-center justify-center gap-1 px-3 text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-4" /> Očisti
        </button>
      )}
    </div>
  );
}
