/**
 * Skeleton dok se /admin/recenzije učitava (popis klijenata radi upite nad cijelom bazom
 * Recenzija). Oblik prati stranicu: naslov, kartica SMS pošiljatelja, statistike i par klijenata.
 */
export default function AdminRecenzijeLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Učitavanje">
      <div className="flex flex-col gap-2">
        <div className="neu-skeleton" style={{ height: 22, width: "30%" }} />
        <div className="neu-skeleton" style={{ height: 12, width: "60%" }} />
      </div>

      <div className="neu-card px-4 py-4 flex flex-col gap-3">
        <div className="neu-skeleton" style={{ height: 14, width: "35%" }} />
        <div className="neu-skeleton" style={{ height: 12, width: "80%" }} />
        <div className="neu-skeleton" style={{ height: 36, width: "100%" }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="neu-card px-4 py-3 flex flex-col gap-2">
            <div className="neu-skeleton" style={{ height: 24, width: "60%" }} />
            <div className="neu-skeleton" style={{ height: 10, width: "80%" }} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="neu-card px-4 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="neu-skeleton" style={{ height: 16, width: "45%" }} />
              <div className="neu-skeleton" style={{ height: 20, width: 90, borderRadius: 999 }} />
            </div>
            <div className="neu-skeleton" style={{ height: 10, width: "70%" }} />
            <div className="neu-skeleton" style={{ height: 32, width: 160, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
