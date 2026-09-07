import { notFound, redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { getSubscriptionById, listProperties, listCompanies } from "@/lib/db/queries";
import { updateSubscriptionAction } from "@/lib/actions";
import SubscriptionForm from "@/components/admin/SubscriptionForm";
import DeleteSubscriptionButton from "@/components/admin/DeleteSubscriptionButton";

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (!admin.isSuperAdmin) redirect("/admin");

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const [subscription, properties, companies] = await Promise.all([
    getSubscriptionById(numericId),
    listProperties(),
    listCompanies(),
  ]);
  if (!subscription) notFound();

  const boundAction = updateSubscriptionAction.bind(null, numericId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Uredi pretplatu: {subscription.sourceName}</h1>
        <DeleteSubscriptionButton id={subscription.id} name={subscription.sourceName} />
      </div>
      <SubscriptionForm
        subscription={subscription}
        properties={properties}
        companies={companies}
        action={boundAction}
        submitLabel="Spremi izmjene"
      />
    </div>
  );
}
