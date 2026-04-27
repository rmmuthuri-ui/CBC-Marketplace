import Link from "next/link";
import { MARKETPLACE_SUBJECTS, subjectToSlug } from "@/lib/subjects";

const whyPoints = [
  {
    title: "Curriculum Aligned",
    body: "All resources are carefully designed to match the CBC/CBE curriculum and learning outcomes.",
  },
  {
    title: "Teacher-Created Resources",
    body: "Created by experienced educators who understand real classroom needs.",
  },
  {
    title: "Time-Saving Materials",
    body: "Ready-to-use resources so you can focus more on teaching and less on preparation.",
  },
  {
    title: "Wide Subject Coverage",
    body: "Access materials across multiple subjects and grade levels in one place.",
  },
] as const;

export default function Home() {
  return (
    <div className="space-y-10 pb-12">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-green-700 to-blue-700 px-6 py-12 text-white shadow-lg sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            CBC/CBE Marketplace
          </h1>
          <p className="mt-3 text-lg font-medium text-green-50 sm:text-xl">
            Your one-stop platform for high-quality, ready-to-use CBC/CBE teaching and learning
            resources.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-blue-50 sm:text-base">
            Save time, improve lesson delivery, and support learner success with expertly designed
            lesson plans, worksheets, projects, and assessments across all CBC/CBE subjects.
          </p>
          <Link
            href="#browse-categories"
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-green-800 shadow-md transition hover:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Browse Resources
          </Link>
        </div>
      </section>

      {/* Why choose us */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Why Choose CBC/CBE Marketplace?
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {whyPoints.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-5 transition hover:border-blue-200 hover:shadow-sm"
            >
              <h3 className="text-base font-semibold text-blue-800">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Platform guide */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          How to Use This Platform
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-100 bg-slate-50/80 p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-blue-800">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">B</span>
              For Buyers
            </h3>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              <li>
                <span className="font-semibold text-slate-700">1.</span> Browse subjects and open the resource you need.
              </li>
              <li>
                <span className="font-semibold text-slate-700">2.</span> Enter your phone and complete M-PESA payment.
              </li>
              <li>
                <span className="font-semibold text-slate-700">3.</span> Click check status, then download instantly.
              </li>
            </ol>
          </article>
          <article className="rounded-xl border border-slate-100 bg-slate-50/80 p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-blue-800">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">S</span>
              For Sellers
            </h3>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              <li>
                <span className="font-semibold text-slate-700">1.</span> Open Become a Seller and verify your email.
              </li>
              <li>
                <span className="font-semibold text-slate-700">2.</span> Submit your first application and first resource.
              </li>
              <li>
                <span className="font-semibold text-slate-700">3.</span> After approval, use Seller Dashboard for uploads and earnings.
              </li>
            </ol>
          </article>
        </div>
      </section>

      {/* Categories */}
      <section id="browse-categories" className="scroll-mt-24 space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Browse by subject</h2>
        <p className="text-sm text-slate-600 sm:text-base">
          Select a subject to see resources aligned with that area of the curriculum.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MARKETPLACE_SUBJECTS.map((subject) => (
            <Link
              key={subject}
              href={`/subjects/${subjectToSlug(subject)}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-green-400 hover:bg-green-50/50 hover:text-green-800"
            >
              {subject}
            </Link>
          ))}
        </div>
      </section>

      {/* Contact / feedback */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Contact Us</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          Have feedback, partnership ideas, or support questions? Reach out and we will be happy
          to help.
        </p>
        <div className="mt-5 text-sm sm:text-base">
          <p className="font-medium text-slate-700">
            Contact us via email: <span className="text-blue-700">cbcmarketplaceke@gmail.com</span>
          </p>
        </div>
      </section>
    </div>
  );
}
