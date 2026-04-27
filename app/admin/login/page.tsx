"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/admin/review";

  const [adminKey, setAdminKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setIsError(false);
    setMessage("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "x-admin-key": adminKey,
        },
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setIsError(true);
        setMessage(data?.error ?? "Admin login failed.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("Could not login right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Admin Login</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Enter your admin review key to access the moderation dashboard.
        </p>
      </header>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="password"
          placeholder="ADMIN_REVIEW_KEY"
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Login to Admin Review"}
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
    </section>
  );
}
