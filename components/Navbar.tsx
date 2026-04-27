import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-bold text-blue-700">
          CBC/CBE Marketplace
        </Link>
        <div className="flex items-center gap-3 text-sm font-medium">
          <Link
            href="/sell"
            className="rounded-md border border-green-300 px-3 py-1.5 text-green-700 transition hover:bg-green-50"
          >
            Become a Seller
          </Link>
          <Link
            href="/seller"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
          >
            Seller Dashboard
          </Link>
          <Link
            href="/admin/login"
            className="rounded-md border border-purple-300 px-3 py-1.5 text-purple-700 transition hover:bg-purple-50"
            title="Admin area"
            aria-label="Admin area"
          >
            Admin
          </Link>
        </div>
      </nav>
    </header>
  );
}
