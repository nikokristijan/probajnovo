import { requireFullAdmin } from "@/lib/auth";
import { createProductAction } from "@/lib/actions";
import ProductForm from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  await requireFullAdmin();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Novi proizvod</h1>
      <ProductForm action={createProductAction} submitLabel="Objavi proizvod" />
    </div>
  );
}
