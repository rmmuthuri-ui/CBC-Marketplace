import { notFound } from "next/navigation";
import { MpesaPaymentForm } from "@/components/MpesaPaymentForm";
import { getProductById } from "@/lib/products";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const { data: product, error } = await getProductById(id);

  if (error) {
    return (
      <section>
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load product: {error}
        </p>
      </section>
    );
  }

  if (!product) {
    notFound();
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-bold text-slate-900">{product.title}</h1>
      <p className="mt-4 leading-7 text-slate-700">{product.description}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
          <p className="mt-1 text-lg font-semibold text-blue-700">KSh {product.price}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Subject</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{product.subject}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Grade</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{product.grade}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Resource file</p>
          <p className="mt-1 break-all text-sm font-semibold text-slate-800">{product.filePath}</p>
        </div>
      </div>

      <MpesaPaymentForm
        defaultAmount={product.price}
        resourceId={product.id}
        resourceFile={product.filePath}
      />
    </article>
  );
}
