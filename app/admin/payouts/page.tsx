"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SellerPayout = {
  id: string;
  seller_email: string;
  period_start: string;
  period_end: string;
  total_gross: number;
  total_fee: number;
  total_net: number;
  status: string;
  payment_reference: string | null;
};

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [selectedPayoutId, setSelectedPayoutId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadPayouts = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/payouts");
      const data = (await response.json().catch(() => null)) as
        | { payouts?: SellerPayout[]; error?: string }
        | null;

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/admin/login?next=/admin/payouts");
          return;
        }
        setIsError(true);
        setMessage(data?.error ?? "Failed to load payouts.");
        return;
      }

      setPayouts(data?.payouts ?? []);
    } catch {
      setIsError(true);
      setMessage("Could not load payouts.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  async function clearAdminSession() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setPayouts([]);
    router.push("/admin/login");
  }

  async function createPayoutBatch() {
    if (!periodStart || !periodEnd) {
      setIsError(true);
      setMessage("Choose both period start and period end.");
      return;
    }

    const response = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_batch",
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(`${periodEnd}T23:59:59.999Z`).toISOString(),
      }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; created?: number } | null;
    if (!response.ok) {
      setIsError(true);
      setMessage(data?.error ?? "Failed to create payout batch.");
      return;
    }

    setIsError(false);
    setMessage(`Created ${data?.created ?? 0} payout batch(es).`);
    await loadPayouts();
  }

  async function markPayoutPaid() {
    if (!selectedPayoutId || !payoutReference.trim()) {
      setIsError(true);
      setMessage("Select payout and enter payment reference.");
      return;
    }

    const response = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_paid",
        payoutId: selectedPayoutId,
        paymentReference: payoutReference.trim(),
      }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setIsError(true);
      setMessage(data?.error ?? "Failed to mark payout as paid.");
      return;
    }

    setIsError(false);
    setMessage("Payout marked as paid.");
    setPayoutReference("");
    await loadPayouts();
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Admin Payouts</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Create bi-weekly payout batches and mark completed seller payouts.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
        <Link
          href="/admin/review"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Review
        </Link>
        <Link
          href="/admin/payouts"
          className="rounded-md bg-blue-600 px-3 py-1.5 font-semibold text-white"
        >
          Payouts
        </Link>
        <button
          type="button"
          onClick={clearAdminSession}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={loadPayouts}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Loading..." : "Refresh Payouts"}
        </button>
      </div>

      {message ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            isError ? "border border-red-200 bg-red-50 text-red-700" : "border border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <input
          type="date"
          value={periodStart}
          onChange={(event) => setPeriodStart(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
        />
        <input
          type="date"
          value={periodEnd}
          onChange={(event) => setPeriodEnd(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
        />
        <button
          type="button"
          onClick={createPayoutBatch}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Create Payout Batch
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          value={selectedPayoutId}
          onChange={(event) => setSelectedPayoutId(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
        >
          <option value="">Select ready payout</option>
          {payouts
            .filter((item) => item.status === "ready")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.seller_email} | {new Date(item.period_start).toLocaleDateString()} -{" "}
                {new Date(item.period_end).toLocaleDateString()} | KES {item.total_net}
              </option>
            ))}
        </select>
        <input
          value={payoutReference}
          onChange={(event) => setPayoutReference(event.target.value)}
          placeholder="Payment reference"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
        />
        <button
          type="button"
          onClick={markPayoutPaid}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Mark Paid
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Seller</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Period</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Gross</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Fee</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Payable</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payouts.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={7}>
                  No payouts yet.
                </td>
              </tr>
            ) : (
              payouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="px-4 py-3 text-slate-700">{payout.seller_email}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(payout.period_start).toLocaleDateString()} - {new Date(payout.period_end).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">KES {payout.total_gross}</td>
                  <td className="px-4 py-3 text-slate-700">KES {payout.total_fee}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">KES {payout.total_net}</td>
                  <td className="px-4 py-3 text-slate-700">{payout.status}</td>
                  <td className="px-4 py-3 text-slate-700">{payout.payment_reference ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
