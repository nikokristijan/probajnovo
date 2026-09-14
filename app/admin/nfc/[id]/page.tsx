import { notFound } from "next/navigation";
import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { getNfcTagById } from "@/lib/db/queries";
import { updateNfcTagAction } from "@/lib/actions";
import NfcTagForm from "@/components/admin/NfcTagForm";
import DeleteNfcTagButton from "@/components/admin/DeleteNfcTagButton";

export default async function EditNfcTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFullAdmin();

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const tag = await getNfcTagById(numericId);
  if (!tag) notFound();

  const boundAction = updateNfcTagAction.bind(null, numericId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Uredi: {tag.label}</h1>
        <DeleteNfcTagButton id={tag.id} label={tag.label} />
      </div>
      <Link
        href={`/nfc/${tag.slug}`}
        target="_blank"
        className="text-xs font-semibold text-[#ff7f00] block mb-6"
      >
        probajnovo.com/nfc/{tag.slug} ↗
      </Link>
      <NfcTagForm tag={tag} action={boundAction} submitLabel="Spremi izmjene" />
    </div>
  );
}
