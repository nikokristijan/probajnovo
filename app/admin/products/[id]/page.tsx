import { notFound } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import { getProductById, getProductPromoStats } from "@/lib/db/queries";
import { dateStringOffsetFromTodayZagreb } from "@/lib/date";
import { updateProductAction } from "@/lib/actions";
import ProductForm from "@/components/admin/ProductForm";
import DeleteProductButton from "@/components/admin/DeleteProductButton";
import ProductAdLinks from "@/components/admin/ProductAdLinks";

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
  const stats = product.slug ? await getProductPromoStats(product.id, dateStringOffsetFromTodayZagreb(-30)) : null;
  const publicUrl = product.slug ? `https://www.probajnovo.com/proizvodi/${product.slug}` : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Uredi: {product.name}</h1>
        <DeleteProductButton id={product.id} name={product.name} />
      </div>
      {publicUrl && stats && product.slug && (
        <section className="neu-card px-4 py-4 sm:px-5 flex flex-col gap-4 mb-6" aria-labelledby="promo-h">
          <h2 id="promo-h" className="text-sm font-semibold">
            Stranica proizvoda i oglasi
          </h2>
          {!product.published && (
            <p className="text-sm text-black/70">Proizvod je skriven — stranica neće raditi dok ga ne objaviš.</p>
          )}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Pregledi, 30 dana", stats.views30d],
              ["Pregledi ukupno", stats.viewsTotal],
              ["Upiti, 30 dana", stats.inquiries30d],
              ["Upiti ukupno", stats.inquiriesTotal],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-black/10 px-3 py-2">
                <dt className="text-xs text-black/60">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <ProductAdLinks url={publicUrl} slug={product.slug} />
        </section>
      )}
      <ProductForm product={product} action={boundAction} submitLabel="Spremi izmjene" />
    </div>
  );
}
