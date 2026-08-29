import { redirect, notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { getStudyById } from "@/lib/db/queries";
import { updateStudyAction } from "@/lib/actions";
import StudyForm from "@/components/admin/StudyForm";
import DeleteStudyButton from "@/components/admin/DeleteStudyButton";

export default async function EditStudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const study = await getStudyById(numericId);
  if (!study) notFound();

  const boundAction = updateStudyAction.bind(null, numericId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Uredi: {study.title}</h1>
        <DeleteStudyButton id={study.id} name={study.title} />
      </div>
      <StudyForm study={study} action={boundAction} submitLabel="Spremi izmjene" />
    </div>
  );
}
