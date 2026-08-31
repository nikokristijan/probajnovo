import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listInquiries } from "@/lib/db/queries";
import { markInquiryReadAction, markInquiryRepliedAction } from "@/lib/actions";
import DeleteInquiryButton from "@/components/admin/DeleteInquiryButton";

const SOURCE_LABEL: Record<string, string> = {
  property: "Vikendica",
  company: "Firma",
  agency: "NOVO (agencija)",
};

export default async function AdminInquiriesPage() {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");

  const inquiries = await listInquiries();
  const unreadCount = inquiries.filter((i) => !i.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Upiti</h1>
        {unreadCount > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ff7f00]/10 text-[#ff7f00]">
            {unreadCount} nepročitano
          </span>
        )}
      </div>
      <p className="text-sm text-black/60 mb-6">
        Upiti poslani putem obrasca na stranicama vikendica i firmi.
      </p>

      {inquiries.length === 0 ? (
        <p className="text-sm text-black/60">
          Još nema poslanih upita. Ako je tablica tek stvorena SQL migracijom, prvi upit će se
          pojaviti ovdje čim netko pošalje obrazac.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {inquiries.map((i) => (
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
                  <DeleteInquiryButton id={i.id} name={i.name} />
                </div>
              </div>
              <p className="text-sm mt-3 whitespace-pre-wrap">{i.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
