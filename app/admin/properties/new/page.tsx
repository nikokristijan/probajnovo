import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { createPropertyAction } from "@/lib/actions";
import PropertyForm from "@/components/admin/PropertyForm";

export default async function NewPropertyPage() {
const admin = await getCurrentAdmin();
if (!admin) redirect("/admin/login");

return (
<div>
<h1 className="text-xl font-bold mb-6">Nova vikendica</h1>
<PropertyForm action={createPropertyAction} submitLabel="Objavi vikendicu" />
</div>
);
}
