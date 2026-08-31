import { requireFullAdmin } from "@/lib/auth";
import { getAgency } from "@/lib/db/queries";
import AgencyForm from "@/components/admin/AgencyForm";

export default async function AdminAgencyPage() {
await requireFullAdmin();

const agency = await getAgency();
if (!agency) {
return (
<p className="text-sm text-red-600">
Agencijski redak ne postoji u bazi — pokreni <code>npm run db:seed</code>.
</p>
);
}

return (
<div>
<h1 className="text-xl font-bold mb-6">Sadržaj agencije (novo.hr)</h1>
<AgencyForm agency={agency} />
</div>
);
}
