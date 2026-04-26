"use client";

import { useEffect, useState } from "react";

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

export default function AdminReviewPage() {
  const [adminKey, setAdminKey] = useState("");
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [resources, setResources] = useState<SellerResource[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("admin_review_key") || "";
    if (saved) {
      setAdminKey(saved);
    }
  }, []);

  async function loadQueue() {
    if (!adminKey.trim()) {
      setIsError(true);
      setMessage("Enter admin key first.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setIsError(false);
    window.localStorage.setItem("admin_review_key", adminKey);

    try {
      const response = await fetch("/api/admin/review", {
        headers: {
          "x-admin-key": adminKey,
        },
      });
      const data = (await response.json().catch(() => null)) as
        | QueueResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        setIsError(true);
        setMessage((data as { error?: string } | null)?.error ?? "Failed to load review queue.");
        return;
      }

      setApplications((data as QueueResponse).applications ?? []);
      setResources((data as QueueResponse).resources ?? []);
    } catch {
      setIsError(true);
      setMessage("Could not load review queue.");
    } finally {
      setIsLoading(false);
    }
  }

  async function reviewApplication(id: string, action: "approve" | "reject") {
    const response = await fetch("/api/admin/review/application", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
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
        "x-admin-key": adminKey,
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

  return (
    <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Admin Review Queue</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Review pending seller applications and seller-submitted resources.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="password"
          placeholder="ADMIN_REVIEW_KEY"
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
        />
        <button
          type="button"
          onClick={loadQueue}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Loading..." : "Load Queue"}
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
    </section>
  );
}
