import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  listInquiriesForAdmin,
  listPropertiesForAdmin,
  listCompaniesForAdmin,
  getPropertyById,
} from "@/lib/db/queries";
import { markInquiryReadAction, markInquiryRepliedAction, createTaskFromInquiryAction } from "@/lib/actions";
import DeleteInquiryButton from "@/components/admin/DeleteInquiryButton";
import QuickReplyForm from "@/components/admin/QuickReplyForm";
import OwnerQuickReplyForm from "@/components/admin/OwnerQuickReplyForm";
import Pagination from "@/components/admin/Pagination";

const INQ_PAGE_SIZE = 30;
const STATUS_FILTERS = [
  { key: "", label: "Svi" },
  { key: "bez-odgovora", label: "Bez odgovora" },
  { key: "neprocitani", label: "Nepročitani" },
  { key: "odgovoreni", label: "Odgovoreni" },
] as const;

const SOURCE_LABEL: Record<string, string> = {
  property: "Vikendica",
  company: "Firma",
  agency: "NOVO (agencija)",
  product: "Proizvod",
};

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; status?: string; q?: string; page?: string }>;
}) {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");

  // Vlasnik vidi SAMO upite svojih vikendica/firmi (admin_access) — nikad agencijske
  // upite (source="agency") ni tuđe vikendice. Puni admin vidi sve, kao dosad.
  let inquiries = await listInquiriesForAdmin(admin);

  // ?property=ID — filtrira na upite JEDNE vikendice, iz app/admin/vikendice/[id]
  // huba za pune admine (Kalendar/Rezervacije/Upiti grupirani po vikendici da
  // nav ne bude krcat, vidi app/admin/layout.tsx).
  const sp = await searchParams;
  const filterPropertyId = sp.property ? Number(sp.property) : null;
  const filterProperty = filterPropertyId ? await getPropertyById(filterPropertyId) : null;
  if (filterPropertyId) {
    inquiries = inquiries.filter((i) => i.source === "property" && i.sourceId === filterPropertyId);
  }

  // Ime(na) dodijeljene vikendice/firme za naslov ispod ("Upiti — Sokak bez
  // imena") — bez ovoga generički naslov "Upiti" zna zbunjivati vlasnika koji
  // upravlja samo jednom vikendicom (djeluje kao da su prikazani upiti svih).
  let ownerScopeLabel: string | null = null;
  const ownedPriceById = new Map<number, number>();
  if (admin.role === "owner") {
    const [ownedProperties, ownedCompanies] = await Promise.all([
      listPropertiesForAdmin(admin),
      listCompaniesForAdmin(admin),
    ]);
    const names = [...ownedProperties.map((p) => p.name), ...ownedCompanies.map((c) => c.name)];
    ownerScopeLabel = names.length > 0 ? names.join(", ") : null;
    for (const p of ownedProperties) ownedPriceById.set(p.id, p.priceFromEur);
  }

  const unreadCount = inquiries.filter((i) => !i.read).length;
  const pageTitle = filterProperty ? `Upiti — ${filterProperty.name}` : ownerScopeLabel ? `Upiti — ${ownerScopeLabel}` : "Upiti";

  // Vlasnički staklen prikaz — NAMJERNO odvojena grana (vidi OwnerMiniCalendar
  // za obrazloženje obrasca), puni admin ispod ostaje potpuno nepromijenjen.
  if (admin.role === "owner") {
    return (
      <div className="owner-dash flex flex-col gap-4" data-theme={admin.themePreference ?? "system"}>
        {filterProperty && (
          <Link href={`/admin/vikendice/${filterProperty.id}`} className="owner-quicklink self-start">
            ← {filterProperty.name}
          </Link>
        )}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold">{pageTitle}</h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="owner-pill owner-pill-warning">{unreadCount} nepročitano</span>
            )}
            {inquiries.length > 0 && (
              <Link href="/api/admin/inquiries/export" className="owner-quicklink">
                Izvezi CSV
              </Link>
            )}
          </div>
        </div>
        <p className="text-sm -mt-2" style={{ color: "var(--od-ink-soft)" }}>
          {filterProperty
            ? `Upiti poslani putem obrasca na stranici ${filterProperty.name}.`
            : ownerScopeLabel
              ? `Upiti poslani putem obrasca na stranici ${ownerScopeLabel}.`
              : "Nemaš dodijeljenu nijednu vikendicu/firmu — javi se glavnom adminu."}
        </p>

        {inquiries.length === 0 ? (
          <div className="owner-glass owner-glass-grain rounded-2xl px-5 py-6 text-sm" style={{ color: "var(--od-ink-soft)" }}>
            Još nema upita. Kad gost pošalje poruku sa stranice, stići će ovdje i na mobitel.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {inquiries.map((i) => (
              <div key={i.id} className="owner-glass owner-glass-grain rounded-2xl px-4 py-3.5">
                {/* Plan #40: prvo tko i poruka, pa glavni gumb "Odgovori";
                    "pročitano"/"odgovoreno" su tihe, sporedne akcije. */}
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-semibold text-sm">{i.name}</span>
                    {i.replied && <span className="owner-pill owner-pill-success">Odgovoreno</span>}
                    {!i.read && !i.replied && <span className="owner-pill owner-pill-info">Novo</span>}
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: "var(--od-ink-faint)" }}>
                    {new Date(i.createdAt).toLocaleString("hr-HR", {
                      timeZone: "Europe/Zagreb",
                      day: "numeric",
                      month: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-[15px] leading-relaxed mt-2 whitespace-pre-wrap">{i.message}</p>
                <div className="text-xs mt-2 flex flex-wrap gap-x-2 gap-y-0.5" style={{ color: "var(--od-ink-faint)" }}>
                  <a href={`mailto:${i.email}`} className="underline-offset-2 hover:underline">
                    {i.email}
                  </a>
                  {i.phone && (
                    <a href={`tel:${i.phone.replace(/\s+/g, "")}`} className="underline-offset-2 hover:underline">
                      · {i.phone}
                    </a>
                  )}
                  <span>· {i.sourceName}</span>
                </div>
                <div className="mt-3">
                  <OwnerQuickReplyForm
                    inquiryId={i.id}
                    guestName={i.name}
                    priceFromEur={i.source === "property" && i.sourceId != null ? ownedPriceById.get(i.sourceId) ?? null : null}
                    secondaryActions={
                      <>
                        {!i.read && (
                          <form action={markInquiryReadAction.bind(null, i.id)}>
                            <button type="submit" className="owner-text-action">
                              Označi pročitano
                            </button>
                          </form>
                        )}
                        {!i.replied && (
                          <form action={markInquiryRepliedAction.bind(null, i.id)}>
                            <button type="submit" className="owner-text-action">
                              Već sam odgovorio
                            </button>
                          </form>
                        )}
                      </>
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Plan #24: filtri, pretraga i stranice za pune admine (vlasnik ima malo upita).
  const statusKey = STATUS_FILTERS.some((f) => f.key === sp.status) ? (sp.status ?? "") : "";
  const q = sp.q?.trim().toLowerCase().slice(0, 80) ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const totalAll = inquiries.length;
  const shown = inquiries.filter((i) => {
    if (statusKey === "bez-odgovora" && i.replied) return false;
    if (statusKey === "neprocitani" && i.read) return false;
    if (statusKey === "odgovoreni" && !i.replied) return false;
    if (q) {
      const hay = `${i.name} ${i.email} ${i.phone ?? ""} ${i.message} ${i.sourceName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const pageItems = shown.slice((page - 1) * INQ_PAGE_SIZE, page * INQ_PAGE_SIZE);
  const filterHref = (status: string) => {
    const p = new URLSearchParams();
    if (filterPropertyId) p.set("property", String(filterPropertyId));
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/admin/inquiries?${qs}` : "/admin/inquiries";
  };

  return (
    <div>
      {filterProperty && (
        <Link
          href={`/admin/vikendice/${filterProperty.id}`}
          className="text-xs font-semibold text-black/40 hover:text-[#b35600]"
        >
          ← {filterProperty.name}
        </Link>
      )}
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap mt-1">
        <h1 className="text-xl font-bold">{pageTitle}</h1>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ff7f00]/10 text-[#b35600]">
              {unreadCount} nepročitano
            </span>
          )}
          {inquiries.length > 0 && (
            <Link
              href="/api/admin/inquiries/export"
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
            >
              Izvezi CSV
            </Link>
          )}
        </div>
      </div>
      <p className="text-sm text-black/60 mb-6">
        {filterProperty
          ? `Upiti poslani putem obrasca na stranici ${filterProperty.name}.`
          : admin.role === "owner"
            ? ownerScopeLabel
              ? `Upiti poslani putem obrasca na stranici ${ownerScopeLabel}.`
              : "Nemaš dodijeljenu nijednu vikendicu/firmu — javi se glavnom adminu."
            : "Upiti poslani putem obrasca na stranicama vikendica i firmi."}
      </p>

      {totalAll > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={filterHref(f.key)}
              aria-current={statusKey === f.key ? "page" : undefined}
              className={
                "text-xs font-semibold px-3 py-1.5 rounded-full border " +
                (statusKey === f.key ? "bg-black text-white border-black" : "border-black/15 hover:border-black/40")
              }
            >
              {f.label}
            </Link>
          ))}
          <form method="get" role="search" className="flex items-center gap-2 ml-auto">
            {filterPropertyId && <input type="hidden" name="property" value={filterPropertyId} />}
            {statusKey && <input type="hidden" name="status" value={statusKey} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Pretraži ime, e-mail, poruku…"
              aria-label="Pretraži upite"
              className="admin-input text-sm w-60 max-w-full"
            />
          </form>
        </div>
      )}

      {totalAll === 0 ? (
        <p className="text-sm text-black/60">
          Još nema upita. Kad netko pošalje obrazac sa stranice vikendice ili firme, stići će ovdje.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-black/60">Nijedan upit ne odgovara filtru.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pageItems.map((i) => (
            <div
              key={i.id}
              className={
                "border rounded-xl px-4 py-3.5 bg-white " +
                (i.read ? "border-black/10" : "border-[#ff7f00]/50")
              }
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{i.name}</span>
                    <span className="text-xs text-black/40">{i.email}</span>
                    {i.phone && <span className="text-xs text-black/40">· {i.phone}</span>}
                    {i.replied && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-600/10 text-green-700">
                        Odgovoreno
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-black/50 mt-0.5">
                    {SOURCE_LABEL[i.source] ?? i.source} · {i.sourceName} ·{" "}
                    {new Date(i.createdAt).toLocaleString("hr-HR")}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!i.read && (
                    <form action={markInquiryReadAction.bind(null, i.id)}>
                      <button
                        type="submit"
                        className="text-xs font-semibold text-[#0000c3] border border-[#0000c3]/20 rounded-full px-3 py-1.5 hover:bg-[#0000c3]/5"
                      >
                        Označi pročitano
                      </button>
                    </form>
                  )}
                  {!i.replied && (
                    <form action={markInquiryRepliedAction.bind(null, i.id)}>
                      <button
                        type="submit"
                        className="text-xs font-semibold text-green-700 border border-green-700/20 rounded-full px-3 py-1.5 hover:bg-green-700/5"
                      >
                        Označi odgovoreno
                      </button>
                    </form>
                  )}
                  {admin.role !== "owner" && <DeleteInquiryButton id={i.id} name={i.name} />}
                </div>
              </div>
              <p className="text-sm mt-3 whitespace-pre-wrap">{i.message}</p>
              {/* Plan #28: upit jednim klikom u rezervaciju ili zadatak. */}
              <div className="flex flex-wrap items-start gap-2 mt-3">
                <QuickReplyForm inquiryId={i.id} />
                {i.source === "property" && i.sourceId != null && (
                  <Link
                    href={`/admin/rezervacije?property=${i.sourceId}&fromInquiry=${i.id}#nova-rezervacija`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
                  >
                    Napravi rezervaciju
                  </Link>
                )}
                <form action={createTaskFromInquiryAction.bind(null, i.id)}>
                  <button
                    type="submit"
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
                  >
                    Napravi zadatak u Portalu
                  </button>
                </form>
              </div>
            </div>
          ))}
          <Pagination
            basePath="/admin/inquiries"
            params={{ property: filterPropertyId ? String(filterPropertyId) : undefined, status: statusKey || undefined, q: q || undefined }}
            page={page}
            pageSize={INQ_PAGE_SIZE}
            total={shown.length}
          />
        </div>
      )}
    </div>
  );
}
