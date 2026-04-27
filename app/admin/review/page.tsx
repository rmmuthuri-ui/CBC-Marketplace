"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SellerApplication = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  subjects: string[];
  created_at: string;
};

type SellerResource = {
  id: string;
  seller_name: string;
  seller_email: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  price: number;
  file_url: string | null;
  created_at: string;
};

type QueueResponse = {
  applications: SellerApplication[];
  resources: SellerResource[];
};

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
  paid_at: string | null;
  created_at: string;
};

export default function AdminReviewPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [resources, setResources] = useState<SellerResource[]>([]);
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [selectedPayoutId, setSelectedPayoutId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/review");
      const data = (await response.json().catch(() => null)) as
        | QueueResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/admin/login?next=/admin/review");
          return;
        }
        setIsError(true);
        setMessage((data as { error?: string } | null)?.error ?? "Failed to load review queue.");
        return;
      }

      setApplications((data as QueueResponse).applications ?? []);
      setResources((data as QueueResponse).resources ?? []);

      const payoutsResponse = await fetch("/api/admin/payouts");
      const payoutsData = (await payoutsResponse.json().catch(() => null)) as
        | { payouts?: SellerPayout[]; error?: string }
        | null;
      if (payoutsResponse.ok) {
        setPayouts(payoutsData?.payouts ?? []);
      }
    } catch {
      setIsError(true);
      setMessage("Could not load review queue.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function clearAdminSession() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setApplications([]);
    setResources([]);
    setPayouts([]);
    router.push("/admin/login");
  }

  async function reviewApplication(id: string, action: "approve" | "reject") {
    const response = await fetch("/api/admin/review/application", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ applicationId: id, action }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setIsError(true);
      setMessage(data?.error ?? "Application review failed.");
      return;
    }
    setMessage(`Application ${action}d.`);
    setIsError(false);
    await loadQueue();
  }

  async function reviewResource(id: string, action: "approve" | "reject") {
    const response = await fetch("/api/admin/review/resource", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resourceId: id, action }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setIsError(true);
      setMessage(data?.error ?? "Resource review failed.");
      return;
    }
    setMessage(`Resource ${action}d.`);
    setIsError(false);
    await loadQueue();
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
    await loadQueue();
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
    await loadQueue();
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Admin Review Queue</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Review pending seller applications and seller-submitted resources.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={loadQueue}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Loading..." : "Load Queue"}
        </button>
        <button
          type="button"
          onClick={clearAdminSession}
          className="rounded-md border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Clear Admin Session
        </button>
      </div>

      {message ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            isError
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Pending Seller Applications</h2>
        {applications.length === 0 ? (
          <p className="text-sm text-slate-600">No pending applications.</p>
        ) : (
          applications.map((application) => (
            <article key={application.id} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">{application.full_name}</p>
              <p className="text-sm text-slate-600">{application.email}</p>
              <p className="mt-2 text-sm text-slate-700">
                Subjects: {application.subjects?.join(", ") || "N/A"}
              </p>
              {application.bio ? <p className="mt-1 text-sm text-slate-600">{application.bio}</p> : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => reviewApplication(application.id, "approve")}
                  className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => reviewApplication(application.id, "reject")}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Pending Resource Submissions</h2>
        {resources.length === 0 ? (
          <p className="text-sm text-slate-600">No pending resources.</p>
        ) : (
          resources.map((resource) => (
            <article key={resource.id} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">{resource.title}</p>
              <p className="text-sm text-slate-600">
                {resource.seller_name} ({resource.seller_email})
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {resource.subject} | Grade {resource.grade} | KSh {resource.price}
              </p>
              <p className="mt-2 text-sm text-slate-600">{resource.description}</p>
              {resource.file_url ? (
                <a
                  href={resource.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                >
                  View file link
                </a>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => reviewResource(resource.id, "approve")}
                  className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Approve & Publish
                </button>
                <button
                  type="button"
                  onClick={() => reviewResource(resource.id, "reject")}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Seller Payouts (Bi-weekly)</h2>
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
          <button
            type="button"
            onClick={loadQueue}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh Payouts
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
      </div>
    </section>
  );
}
