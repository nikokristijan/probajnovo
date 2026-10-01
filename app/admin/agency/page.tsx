import { requireFullAdmin } from "@/lib/auth";
import { getAgency } from "@/lib/db/queries";
import AgencyForm from "@/components/admin/AgencyForm";

export default async function AdminAgencyPage() {
await requireFullAdmin();

const agency = await getAgency();
if (!agency) {
return (
<p className="text-sm text-black/70">
Podaci agencije još nisu postavljeni. Javi se developeru da ih doda, pa će se ovdje moći uređivati.
</p>
);
}

return (
<div>
<h1 className="text-xl font-bold mb-6">Sadržaj agencije</h1>
<AgencyForm agency={agency} />
</div>
);
}
