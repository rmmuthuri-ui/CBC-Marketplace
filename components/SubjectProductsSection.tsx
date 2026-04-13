import { ProductCard } from "@/components/ProductCard";
import { getProductsBySubject } from "@/lib/products";

type SubjectProductsSectionProps = {
  subject: string;
};

export async function SubjectProductsSection({ subject }: SubjectProductsSectionProps) {
  const { data: products, error } = await getProductsBySubject(subject);

  return (
    <>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load subject resources: {error}
        </p>
      ) : null}

      {!error && (!products || products.length === 0) ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-slate-600">
          No resources found for this subject yet.
        </p>
      ) : null}

      {!error && products && products.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </>
  );
}
