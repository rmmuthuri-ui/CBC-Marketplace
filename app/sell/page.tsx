"use client";

import { FormEvent, useState } from "react";
import { MARKETPLACE_SUBJECTS } from "@/lib/subjects";

function splitSubjects(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SellPage() {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setIsError(false);
    setMessage("");

    try {
      const applyResponse = await fetch("/api/seller/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
    } catch {
      setIsError(true);
      setMessage("Could not submit at the moment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Become a Seller</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Start Phase 1 onboarding: submit your seller application and first resource for review.
        </p>
      </header>

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
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
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
          disabled={isSubmitting}
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
    </section>
  );
}
