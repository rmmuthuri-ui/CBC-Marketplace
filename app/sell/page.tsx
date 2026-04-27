"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MARKETPLACE_SUBJECTS } from "@/lib/subjects";

function splitSubjects(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SellPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [sellerStatus, setSellerStatus] = useState<
    "approved" | "pending" | "rejected" | "not_applied" | null
  >(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [sellerReviewNotes, setSellerReviewNotes] = useState("");
  const [sellerReviewedAt, setSellerReviewedAt] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [subjects, setSubjects] = useState("Mathematics");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceSubject, setResourceSubject] = useState("Mathematics");
  const [resourceGrade, setResourceGrade] = useState("");
  const [resourcePrice, setResourcePrice] = useState("100");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [uploadedFilePath, setUploadedFilePath] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const userResult = await supabase.auth.getUser();
      if (mounted) {
        const currentUser = userResult.data.user ?? null;
        setUser(currentUser);
        setEmail(currentUser?.email ?? "");
        setIsAuthLoading(false);
      }
    }

    bootstrapAuth();
    const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setEmail(currentUser?.email ?? "");
      setSellerStatus(null);
      setSellerReviewNotes("");
      setSellerReviewedAt("");
    });

    return () => {
      mounted = false;
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  const statusBanner = useMemo(() => {
    if (!email.trim() || !sellerStatus) {
      return null;
    }

    if (sellerStatus === "approved") {
      const reviewedText = sellerReviewedAt
        ? ` Last review: ${new Date(sellerReviewedAt).toLocaleString()}.`
        : "";
      return {
        className: "border border-green-200 bg-green-50 text-green-700",
        message: `Your seller status: Approved. You can upload and submit resources.${reviewedText}`,
      };
    }

    if (sellerStatus === "pending") {
      return {
        className: "border border-amber-200 bg-amber-50 text-amber-700",
        message: "Your seller status: Pending. Wait for admin approval before resource submission.",
      };
    }

    if (sellerStatus === "rejected") {
      const feedback = sellerReviewNotes ? ` Admin feedback: ${sellerReviewNotes}` : "";
      const reviewedText = sellerReviewedAt
        ? ` Last review: ${new Date(sellerReviewedAt).toLocaleString()}.`
        : "";
      return {
        className: "border border-red-200 bg-red-50 text-red-700",
        message: `Your seller status: Rejected.${reviewedText}${feedback} Update your details and reapply.`,
      };
    }

    return {
      className: "border border-slate-200 bg-slate-50 text-slate-700",
      message: "No seller application found for this email yet.",
    };
  }, [email, sellerReviewNotes, sellerReviewedAt, sellerStatus]);

  async function checkSellerStatus() {
    if (!email.trim()) {
      setSellerStatus(null);
      setSellerReviewNotes("");
      setSellerReviewedAt("");
      return;
    }

    setIsCheckingStatus(true);
    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        setSellerStatus(null);
        setSellerReviewNotes("");
        setSellerReviewedAt("");
        return;
      }

      const statusResponse = await fetch(`/api/seller/status?email=${encodeURIComponent(email.trim())}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const statusData = (await statusResponse.json().catch(() => null)) as
        | {
            error?: string;
            status?: "approved" | "pending" | "rejected" | "not_applied";
            notes?: string | null;
            reviewedAt?: string | null;
          }
        | null;

      if (!statusResponse.ok) {
        setSellerStatus(null);
        setSellerReviewNotes("");
        setSellerReviewedAt("");
        return;
      }

      setSellerStatus(statusData?.status ?? "not_applied");
      setSellerReviewNotes(statusData?.notes ?? "");
      setSellerReviewedAt(statusData?.reviewedAt ?? "");
    } finally {
      setIsCheckingStatus(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setIsError(false);
    setMessage("");

    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        setIsError(true);
        setMessage("Your session expired. Please sign in again.");
        return;
      }

      const applyResponse = await fetch("/api/seller/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          bio,
          subjects: splitSubjects(subjects),
        }),
      });

      const applyData = (await applyResponse.json().catch(() => null)) as
        | { error?: string; status?: string }
        | null;
      if (!applyResponse.ok) {
        setIsError(true);
        setMessage(applyData?.error ?? "Failed to submit seller application.");
        return;
      }

      if (applyData?.status !== "approved") {
        setSellerStatus((applyData?.status as "pending" | "rejected" | "not_applied" | undefined) ?? "pending");
        setSellerReviewedAt(new Date().toISOString());
        setSellerReviewNotes("");
        setMessage(
          "Seller application submitted. Your account is pending admin approval. You will be able to submit resources after approval.",
        );
        setIsError(false);
        return;
      }

      let finalFileUrl = uploadedFileUrl;
      if (resourceFile && !finalFileUrl) {
        const uploadForm = new FormData();
        uploadForm.set("sellerEmail", email);
        uploadForm.set("title", resourceTitle);
        uploadForm.set("file", resourceFile);

        const uploadResponse = await fetch("/api/seller/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: uploadForm,
        });
        const uploadData = (await uploadResponse.json().catch(() => null)) as
          | { error?: string; fileUrl?: string; filePath?: string }
          | null;

        if (!uploadResponse.ok || !uploadData?.fileUrl) {
          setIsError(true);
          setMessage(uploadData?.error ?? "File upload failed.");
          return;
        }

        finalFileUrl = uploadData.fileUrl;
        setUploadedFileUrl(uploadData.fileUrl);
        setUploadedFilePath(uploadData.filePath ?? "");
      }

      const resourceResponse = await fetch("/api/seller/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          sellerName: fullName,
          sellerEmail: email,
          title: resourceTitle,
          description: resourceDescription,
          subject: resourceSubject,
          grade: resourceGrade,
          price: Number(resourcePrice),
          fileUrl: finalFileUrl || undefined,
        }),
      });

      const resourceData = (await resourceResponse.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!resourceResponse.ok) {
        setIsError(true);
        setMessage(resourceData?.error ?? "Failed to submit resource.");
        return;
      }

      setMessage(
        "Application and resource submitted. We will review your seller account and resource before publishing.",
      );
      setIsError(false);
      setSellerStatus("approved");
      setSellerReviewedAt(new Date().toISOString());
    } catch {
      setIsError(true);
      setMessage("Could not submit at the moment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSendingLink(true);
    setIsError(false);
    setMessage("");

    try {
      const authResult = await supabase.auth.signInWithOtp({
        email: authEmail.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/sell`,
        },
      });
      if (authResult.error) {
        setIsError(true);
        setMessage(authResult.error.message);
        return;
      }
      setMessage("Magic sign-in link sent. Check your email, then open the link.");
    } catch {
      setIsError(true);
      setMessage("Could not send sign-in link right now. Please try again.");
    } finally {
      setIsSendingLink(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setEmail("");
    setMessage("Signed out successfully.");
    setIsError(false);
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Become a Seller</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          First-time onboarding: submit your seller application and first resource for review.
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
            {isSendingLink ? "Sending link..." : "Send Magic Link"}
          </button>
        </form>
      )}

      {sellerStatus === "approved" ? (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Your seller account is already approved. Use your seller dashboard for new uploads and resource management.
          </p>
          <Link
            href="/seller"
            className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to Seller Dashboard
          </Link>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            required
          />
          <input
            type="email"
            value={email}
            readOnly
            onBlur={checkSellerStatus}
            placeholder="Signed-in seller email"
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none ring-green-500 focus:ring"
            required
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone (optional)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
          />
          <input
            value={subjects}
            onChange={(event) => setSubjects(event.target.value)}
            placeholder="Subjects (comma-separated)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={checkSellerStatus}
            disabled={!user?.email || !email.trim() || isCheckingStatus}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingStatus ? "Checking..." : "Check Seller Status"}
          </button>
          {statusBanner ? <p className={`rounded-md px-3 py-2 text-sm ${statusBanner.className}`}>{statusBanner.message}</p> : null}
        </div>

        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Short teacher bio"
          className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
        />

        <hr className="border-slate-200" />

        <h2 className="text-xl font-semibold text-slate-900">Submit First Resource</h2>
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
            {uploadedFileUrl ? (
              <p className="mt-2 text-xs text-green-700">
                Uploaded: <span className="font-medium">{uploadedFilePath || uploadedFileUrl}</span>
              </p>
            ) : null}
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
          disabled={isSubmitting || !user?.email}
          className="rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Submit for Review"}
        </button>

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
      </form>
      )}
    </section>
  );
}
