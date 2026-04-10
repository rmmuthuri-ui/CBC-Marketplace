import { ProductCard } from "@/components/ProductCard";
import { getProductsBySubject } from "@/lib/products";

type CategoryPageProps = {
  params: Promise<{ subject: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { subject } = await params;
  const decodedSubject = decodeURIComponent(subject);
  const { data: products, error } = await getProductsBySubject(decodedSubject);

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold text-slate-900">{decodedSubject}</h1>
      <p className="text-slate-600">Browse all resources under this subject.</p>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load category products: {error}
        </p>
      ) : null}

      {!error && (!products || products.length === 0) ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-slate-600">
          No products found for this subject.
        </p>
      ) : null}

      {!error && products && products.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
