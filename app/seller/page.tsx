export default function SellerDashboardPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-bold text-slate-900">Seller Dashboard (Phase 1)</h1>
      <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
        This dashboard is the starting point for the marketplace seller experience. In this phase,
        sellers apply, submit resources for review, and wait for admin approval.
      </p>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Next implementation steps: seller authentication, resource upload to storage, and admin
        moderation workflow.
      </div>
    </section>
  );
}
