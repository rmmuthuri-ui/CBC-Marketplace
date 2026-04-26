"use client";

import { FormEvent, useState } from "react";

type SellerLedgerEntry = {
  id: string;
  created_at: string;
  entry_type: string;
  status: string;
  resource_id: string | null;
  source_payment_id: string | null;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
};

type SellerLedgerResponse = {
  seller?: {
    email: string;
    displayName?: string | null;
    status?: string | null;
  };
  totals?: {
    accrued: number;
    paidOut: number;
    lifetimeNet: number;
    entries: number;
  };
  entries?: SellerLedgerEntry[];
  error?: string;
};

function formatKes(amount: number): string {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

export default function SellerDashboardPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [message, setMessage] = useState("");
  const [ledgerData, setLedgerData] = useState<SellerLedgerResponse | null>(null);

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setIsError(false);
    setMessage("");

    try {
      const response = await fetch(`/api/seller/ledger?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      const data = (await response.json().catch(() => null)) as SellerLedgerResponse | null;

      if (!response.ok) {
        setLedgerData(null);
        setIsError(true);
        setMessage(data?.error ?? "Failed to load seller earnings.");
        return;
      }

      setLedgerData(data);
      setIsError(false);
      setMessage("");
    } catch {
      setLedgerData(null);
      setIsError(true);
      setMessage("Could not load earnings right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Seller Earnings Dashboard</h1>
        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
          Enter your seller email to view accrued earnings and your ledger history.
        </p>
      </header>

      <form onSubmit={handleLookup} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seller@email.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Loading..." : "View Earnings"}
        </button>
      </form>

      {message ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            isError ? "border border-red-200 bg-red-50 text-red-700" : "border border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      {ledgerData?.totals ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Accrued</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatKes(ledgerData.totals.accrued)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Paid Out</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatKes(ledgerData.totals.paidOut)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Lifetime Net</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatKes(ledgerData.totals.lifetimeNet)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Entries</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{ledgerData.totals.entries}</p>
          </div>
        </div>
      ) : null}

      {ledgerData?.entries ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Resource</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Gross</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Commission</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerData.entries.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={7}>
                    No earnings entries found yet.
                  </td>
                </tr>
              ) : (
                ledgerData.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-slate-700">{new Date(entry.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700">{entry.entry_type}</td>
                    <td className="px-4 py-3 text-slate-700">{entry.status}</td>
                    <td className="px-4 py-3 text-slate-700">{entry.resource_id ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatKes(entry.gross_amount)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatKes(entry.commission_amount)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatKes(entry.net_amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
