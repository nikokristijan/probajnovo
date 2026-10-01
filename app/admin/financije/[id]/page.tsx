import { notFound, redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { getSubscriptionById, listProperties, listCompanies, listPaymentsForSubscription } from "@/lib/db/queries";
import { deletePaymentAction } from "@/lib/actions-superadmin";
import { todayDateStringZagreb } from "@/lib/date";
import { describeSubscription, TONE_CLASSES } from "@/lib/subscriptionState";
import PaymentForm from "@/components/admin/PaymentForm";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
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

  const [subscription, properties, companies, payments] = await Promise.all([
    getSubscriptionById(numericId),
    listProperties(),
    listCompanies(),
    listPaymentsForSubscription(numericId),
  ]);
  if (!subscription) notFound();

  const boundAction = updateSubscriptionAction.bind(null, numericId);
  const today = todayDateStringZagreb();
  const st = describeSubscription(subscription, today);
  const paidTotal = payments.reduce((sum, p) => sum + p.amountEur, 0);
  const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Uredi pretplatu: {subscription.sourceName}</h1>
        <DeleteSubscriptionButton id={subscription.id} name={subscription.sourceName} />
      </div>
      <section className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold">Uplate</h2>
          <span className={"text-[11px] font-semibold px-2.5 py-1 rounded-full " + TONE_CLASSES[st.tone]}>
            {st.label} · sljedeća naplata {fmtDate(subscription.nextRenewalDate)}
          </span>
        </div>
        <PaymentForm subscriptionId={subscription.id} monthlyPriceEur={subscription.monthlyPriceEur} today={today} />
        {payments.length === 0 ? (
          <p className="text-sm text-black/60">Još nema zapisanih uplata.</p>
        ) : (
          <div className="flex flex-col">
            <p className="text-xs text-black/60 mb-2">
              Ukupno uplaćeno: <span className="font-semibold tabular-nums">{paidTotal.toLocaleString("hr-HR")} €</span>
            </p>
            <ul className="flex flex-col divide-y divide-black/10 border-y border-black/10">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="tabular-nums">
                    <span className="font-semibold">{p.amountEur.toLocaleString("hr-HR")} €</span>
                    <span className="text-black/60">
                      {" "}
                      · {fmtDate(p.paidOn)} · {p.months} {p.months === 1 ? "mjesec" : p.months < 5 ? "mjeseca" : "mjeseci"}
                      {p.method ? ` · ${p.method}` : ""}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </span>
                  <ConfirmSubmit
                    action={deletePaymentAction.bind(null, p.id)}
                    title={`Obrisati uplatu od ${p.amountEur} €?`}
                    description="Zapis se briše, ali datum sljedeće naplate se ne vraća — po potrebi ga ispravi u obrascu ispod."
                    confirmLabel="Obriši uplatu"
                    buttonLabel="Obriši"
                    buttonClassName="text-xs font-semibold text-black/60 hover:text-black"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <h2 className="text-sm font-semibold -mb-2">Podaci pretplate</h2>
      {/* key: nakon uplate se datum naplate promijeni — forma se mora
          ponovno napuniti, inače bi "Spremi" vratio stari datum. */}
      <SubscriptionForm
        key={subscription.updatedAt.toISOString()}
        subscription={subscription}
        properties={properties}
        companies={companies}
        action={boundAction}
        submitLabel="Spremi izmjene"
      />
    </div>
  );
}
