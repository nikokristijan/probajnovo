import { requireFullAdmin } from "@/lib/auth";
import { createNfcTagAction } from "@/lib/actions";
import NfcTagForm from "@/components/admin/NfcTagForm";

export default async function NewNfcTagPage() {
  await requireFullAdmin();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Nova NFC oznaka</h1>
      <NfcTagForm action={createNfcTagAction} submitLabel="Objavi NFC oznaku" />
    </div>
  );
}
