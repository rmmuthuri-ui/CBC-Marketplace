import Link from "next/link";
import type { Product } from "@/lib/products";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            {product.subject}
          </span>
          <span className="text-sm font-semibold text-blue-700">KSh {product.price}</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{product.title}</h3>
        <p className="line-clamp-3 text-sm text-slate-600">{product.description}</p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Grade: {product.grade}</span>
        <Link
          href={`/product/${product.id}`}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          View
        </Link>
      </div>
    </article>
  );
}
