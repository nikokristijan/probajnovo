/**
 * Skeleton dok se /admin (superadmin pregled ILI vlasnički dashboard, ovisno
 * o roli — vidi app/admin/page.tsx) učitava — na izričit zahtjev ("no
 * loading or empty screens", vidi priloženi TikTok "signs" pregled: "AI
 * builds the happy path, add skeletons"). Next.js App Router automatski
 * prikazuje ovo dok se async AdminDashboard/OwnerDashboard podaci dohvaćaju
 * (Suspense boundary oko app/admin/page.tsx), bez ijedne dodatne linije
 * klijentskog koda — čisti Server Component, layout (nav) iznad ostaje
 * odmah vidljiv i interaktivan.
 *
 * Oblik prati stvaran sadržaj (red statistika + par redaka popisa) da
 * prijelaz skeleton→sadržaj ne "skoči" layoutom kad se podaci pojave.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Učitavanje">
      <div className="neu-skeleton" style={{ height: 22, width: "40%" }} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="neu-card px-4 py-3 flex flex-col gap-2">
            <div className="neu-skeleton" style={{ height: 24, width: "60%" }} />
            <div className="neu-skeleton" style={{ height: 10, width: "80%" }} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="neu-card px-4 py-3 flex items-center justify-between">
            <div className="flex flex-col gap-2" style={{ width: "60%" }}>
              <div className="neu-skeleton" style={{ height: 12, width: "70%" }} />
              <div className="neu-skeleton" style={{ height: 10, width: "90%" }} />
            </div>
            <div className="neu-skeleton" style={{ height: 20, width: 64, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
