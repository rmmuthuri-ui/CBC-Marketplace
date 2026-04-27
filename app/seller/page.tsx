"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { MARKETPLACE_SUBJECTS } from "@/lib/subjects";

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

type SellerResourceEntry = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  price: number;
  review_status: string;
  rejection_reason: string | null;
  published_product_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type SellerResourcesResponse = {
  sellerEmail?: string;
  entries?: SellerResourceEntry[];
  error?: string;
};

function formatKes(amount: number): string {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

export default function SellerDashboardPage() {
  const [authEmail, setAuthEmail] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [message, setMessage] = useState("");
  const [ledgerData, setLedgerData] = useState<SellerLedgerResponse | null>(null);
  const [resourceData, setResourceData] = useState<SellerResourcesResponse | null>(null);
  const [isSubmittingResource, setIsSubmittingResource] = useState(false);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceSubject, setResourceSubject] = useState("Mathematics");
  const [resourceGrade, setResourceGrade] = useState("");
  const [resourcePrice, setResourcePrice] = useState("100");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceMessage, setResourceMessage] = useState("");
  const [resourceError, setResourceError] = useState(false);

  async function loadLedgerByEmail(email: string) {
    setIsLoading(true);
    setIsError(false);
    setMessage("");

    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        setLedgerData(null);
        setIsError(true);
        setMessage("Your session expired. Please sign in again.");
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const [ledgerResponse, resourcesResponse] = await Promise.all([
        fetch(`/api/seller/ledger?email=${encodeURIComponent(normalizedEmail)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch("/api/seller/resources", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      ]);

      const data = (await ledgerResponse.json().catch(() => null)) as SellerLedgerResponse | null;
      const resourcesData = (await resourcesResponse.json().catch(() => null)) as SellerResourcesResponse | null;

      if (!ledgerResponse.ok) {
        setLedgerData(null);
        setResourceData(null);
        setIsError(true);
        setMessage(data?.error ?? "Failed to load seller earnings.");
        return;
      }

      if (!resourcesResponse.ok) {
        setLedgerData(null);
        setResourceData(null);
        setIsError(true);
        setMessage(resourcesData?.error ?? "Failed to load submitted resources.");
        return;
      }

      setLedgerData(data);
      setResourceData(resourcesData);
      setIsError(false);
      setMessage("");
    } catch {
      setLedgerData(null);
      setResourceData(null);
      setIsError(true);
      setMessage("Could not load seller dashboard right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const userResult = await supabase.auth.getUser();
      if (mounted) {
        setUser(userResult.data.user ?? null);
        setIsAuthLoading(false);
      }
    }

    bootstrapAuth();

    const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userEmail = user?.email?.trim().toLowerCase();
    if (!userEmail) {
      setLedgerData(null);
      setResourceData(null);
      return;
    }
    loadLedgerByEmail(userEmail);
  }, [user?.email]);

  async function handleSendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSendingLink(true);
    setIsError(false);
    setMessage("");

    try {
      const normalizedEmail = authEmail.trim().toLowerCase();
      const authResult = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/seller`,
        },
      });

      if (authResult.error) {
        setIsError(true);
        setMessage(authResult.error.message);
        return;
      }

      setIsError(false);
      setMessage("Verification email sent. Check your inbox and click login to continue.");
    } catch {
      setIsError(true);
      setMessage("Could not send verification email right now. Please try again.");
    } finally {
      setIsSendingLink(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setLedgerData(null);
    setResourceData(null);
    setMessage("Signed out successfully.");
    setIsError(false);
  }

  async function handleSubmitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.email) {
      setResourceError(true);
      setResourceMessage("Sign in first to submit a resource.");
      return;
    }
    if (ledgerData?.seller?.status !== "active") {
      setResourceError(true);
      setResourceMessage("Your seller account is not approved yet. Wait for admin approval before submitting resources.");
      return;
    }

    setIsSubmittingResource(true);
    setResourceError(false);
    setResourceMessage("");

    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        setResourceError(true);
        setResourceMessage("Your session expired. Please sign in again.");
        return;
      }

      if (!resourceFile) {
        setResourceError(true);
        setResourceMessage("Please choose a file to upload.");
        return;
      }

      const uploadForm = new FormData();
      uploadForm.set("sellerEmail", user.email);
      uploadForm.set("title", resourceTitle);
      uploadForm.set("file", resourceFile);

      const uploadResponse = await fetch("/api/seller/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: uploadForm,
      });
      const uploadData = (await uploadResponse.json().catch(() => null)) as
        | { error?: string; fileUrl?: string }
        | null;

      if (!uploadResponse.ok || !uploadData?.fileUrl) {
        setResourceError(true);
        setResourceMessage(uploadData?.error ?? "File upload failed.");
        return;
      }

      const sellerName = ledgerData?.seller?.displayName?.trim() || user.email.split("@")[0];
      const submitResponse = await fetch("/api/seller/resources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sellerName,
          sellerEmail: user.email,
          title: resourceTitle,
          description: resourceDescription,
          subject: resourceSubject,
          grade: resourceGrade,
          price: Number(resourcePrice),
          fileUrl: uploadData.fileUrl,
        }),
      });
      const submitData = (await submitResponse.json().catch(() => null)) as { error?: string } | null;
      if (!submitResponse.ok) {
        setResourceError(true);
        setResourceMessage(submitData?.error ?? "Failed to submit resource.");
        return;
      }

      setResourceTitle("");
      setResourceDescription("");
      setResourceSubject("Mathematics");
      setResourceGrade("");
      setResourcePrice("100");
      setResourceFile(null);
      setResourceError(false);
      setResourceMessage("Resource submitted successfully and sent for admin review.");
      await loadLedgerByEmail(user.email);
    } catch {
      setResourceError(true);
      setResourceMessage("Could not submit resource right now. Please try again.");
    } finally {
      setIsSubmittingResource(false);
    }
  }

  function getStatusBadge(status: string): string {
    if (status === "approved") {
      return "border border-green-200 bg-green-50 text-green-700";
    }
    if (status === "rejected") {
      return "border border-red-200 bg-red-50 text-red-700";
    }
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Seller Earnings Dashboard</h1>
        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
          Sign in with your seller email to automatically view your accrued earnings and ledger history.
        </p>
      </header>

      {isAuthLoading ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Checking your session...
        </div>
      ) : user?.email ? (
        <div className="flex flex-col gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Signed in as <span className="font-semibold">{user.email}</span>
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            First time becoming a seller under CBC/CBE dashboard:
            enter your email, click verify, check your email, then click login.
          </p>
          <form onSubmit={handleSendMagicLink} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="seller@email.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
              required
            />
            <button
              type="submit"
              disabled={isSendingLink}
              className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingLink ? "Sending verification..." : "Verify Email Address"}
            </button>
          </form>
        </div>
      )}

      {message ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            isError ? "border border-red-200 bg-red-50 text-red-700" : "border border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      {user?.email && isLoading ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Loading your earnings...
        </div>
      ) : null}

      {user?.email && ledgerData?.totals ? (
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

      {user?.email && ledgerData?.entries ? (
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

      {user?.email ? (
        <section className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h2 className="text-xl font-semibold text-slate-900">Post New Resource</h2>
          <form onSubmit={handleSubmitResource} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                value={resourceTitle}
                onChange={(event) => setResourceTitle(event.target.value)}
                placeholder="Resource title"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring sm:col-span-2"
                required
              />
              <select
                value={resourceSubject}
                onChange={(event) => setResourceSubject(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
                required
              >
                {MARKETPLACE_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              <input
                value={resourceGrade}
                onChange={(event) => setResourceGrade(event.target.value)}
                placeholder="Grade (e.g. 9 or 9 & 10)"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
                required
              />
              <input
                type="number"
                min="1"
                value={resourcePrice}
                onChange={(event) => setResourcePrice(event.target.value)}
                placeholder="Price (KES)"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
                required
              />
              <div className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Resource file
                </label>
                <input
                  type="file"
                  onChange={(event) => setResourceFile(event.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-700"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                  required
                />
              </div>
            </div>
            <textarea
              value={resourceDescription}
              onChange={(event) => setResourceDescription(event.target.value)}
              placeholder="Resource description"
              className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
              required
            />
            <button
              type="submit"
              disabled={isSubmittingResource || ledgerData?.seller?.status !== "active"}
              className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingResource ? "Submitting..." : "Submit Resource"}
            </button>
            {resourceMessage ? (
              <p
                className={`rounded-md px-3 py-2 text-sm ${
                  resourceError
                    ? "border border-red-200 bg-red-50 text-red-700"
                    : "border border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {resourceMessage}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      {user?.email ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">My Submitted Resources</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Grade</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Price</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Review Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Rejection Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(resourceData?.entries ?? []).length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={7}>
                      No submitted resources yet.
                    </td>
                  </tr>
                ) : (
                  (resourceData?.entries ?? []).map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-slate-700">{new Date(entry.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.title}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.subject}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.grade}</td>
                      <td className="px-4 py-3 text-slate-700">{formatKes(entry.price)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(entry.review_status)}`}
                        >
                          {entry.review_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{entry.rejection_reason ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
