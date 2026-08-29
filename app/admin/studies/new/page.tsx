import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { createStudyAction } from "@/lib/actions";
import StudyForm from "@/components/admin/StudyForm";

export default async function NewStudyPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Novi Study</h1>
      <StudyForm action={createStudyAction} submitLabel="Objavi Study" />
    </div>
  );
}
