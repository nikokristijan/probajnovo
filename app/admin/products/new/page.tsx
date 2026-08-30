import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { createProductAction } from "@/lib/actions";
import ProductForm from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Novi proizvod</h1>
      <ProductForm action={createProductAction} submitLabel="Objavi proizvod" />
    </div>
  );
}
