import { notFound } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import { getProductById } from "@/lib/db/queries";
import { updateProductAction } from "@/lib/actions";
import ProductForm from "@/components/admin/ProductForm";
import DeleteProductButton from "@/components/admin/DeleteProductButton";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFullAdmin();

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const product = await getProductById(numericId);
  if (!product) notFound();

  const boundAction = updateProductAction.bind(null, numericId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Uredi: {product.name}</h1>
        <DeleteProductButton id={product.id} name={product.name} />
      </div>
      <ProductForm product={product} action={boundAction} submitLabel="Spremi izmjene" />
    </div>
  );
}
