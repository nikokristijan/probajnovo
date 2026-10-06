import { requireFullAdmin } from "@/lib/auth";
import { createProductAction } from "@/lib/actions";
import { listProducts } from "@/lib/db/queries";
import ProductForm from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  await requireFullAdmin();
  const otherProducts = (await listProducts()).map((p) => ({ id: p.id, name: p.name, priceEur: p.priceEur }));

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Novi proizvod</h1>
      <ProductForm action={createProductAction} submitLabel="Objavi proizvod" otherProducts={otherProducts} />
    </div>
  );
}
