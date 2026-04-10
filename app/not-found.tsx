import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h2 className="text-2xl font-bold text-slate-900">Product not found</h2>
      <p className="mt-2 text-slate-600">
        The product you are looking for does not exist or is no longer available.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Back to homepage
      </Link>
    </div>
  );
}
