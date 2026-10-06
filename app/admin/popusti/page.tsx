import { requireFullAdmin } from "@/lib/auth";
import { getAgency, listDiscountCodes } from "@/lib/db/queries";
import { todayDateStringZagreb } from "@/lib/date";
import DiscountCodesAdmin from "@/components/admin/DiscountCodesAdmin";

export const revalidate = 0;

export default async function AdminDiscountsPage() {
  await requireFullAdmin();
  const [codes, agencyRow] = await Promise.all([listDiscountCodes(), getAgency()]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Popusti i kodovi</h1>
        <p className="text-sm text-black/60 mt-1">
          Akcije i količinski popusti postavljaju se na svakom proizvodu (Proizvodi → Uredi). Ovdje su kodovi koje kupac
          upiše u obrazac i kodovi za preporuku.
        </p>
      </div>
      <DiscountCodesAdmin
        codes={codes.map((c) => ({
          id: c.id,
          code: c.code,
          percent: c.percent,
          active: c.active,
          expiresAt: c.expiresAt,
          maxUses: c.maxUses,
          uses: c.uses,
          note: c.note,
          referrerName: c.referrerName,
          referrerEmail: c.referrerEmail,
        }))}
        referralPercent={agencyRow?.referralPercent ?? 0}
        today={todayDateStringZagreb()}
      />
    </div>
  );
}
