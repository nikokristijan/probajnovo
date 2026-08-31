import { requireFullAdmin } from "@/lib/auth";
import { createStudyAction } from "@/lib/actions";
import StudyForm from "@/components/admin/StudyForm";

export default async function NewStudyPage() {
  await requireFullAdmin();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Novi Study</h1>
      <StudyForm action={createStudyAction} submitLabel="Objavi Study" />
    </div>
  );
}
