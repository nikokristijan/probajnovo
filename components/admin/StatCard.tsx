/**
 * Zajednička "stat" kartica za admin/owner dashboarde. Prije je ista komponenta
 * bila doslovno kopirana (identičan JSX) u app/admin/page.tsx,
 * app/admin/financije/page.tsx i app/admin/vikendice/[id]/page.tsx — izdvojeno
 * ovdje da buduće izmjene stila ne moraju ručno na 3 mjesta.
 *
 * Vrijednost se formatira s hr-HR tisućica separatorom (npr. 12.500 umjesto
 * 12500) — i dalje čitljivo za brojeve poput broja vikendica, ali bitno
 * korisnije za financijske iznose koji rastu preko 4 znamenke.
 */
export function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="border border-black/10 rounded-xl px-4 py-3 bg-white">
      <div className="text-2xl font-bold tabular-nums">
        {value.toLocaleString("hr-HR")}
        {suffix ?? ""}
      </div>
      <div className="text-xs text-black/50 mt-0.5">{label}</div>
    </div>
  );
}

export default StatCard;
