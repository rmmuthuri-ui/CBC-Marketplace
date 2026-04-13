import { notFound } from "next/navigation";
import { SubjectProductsSection } from "@/components/SubjectProductsSection";
import { subjectFromSlug } from "@/lib/subjects";

type SubjectPageProps = {
  params: Promise<{ subject: string }>;
};

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { subject } = await params;
  const subjectName = subjectFromSlug(subject);

  if (!subjectName) {
    notFound();
  }

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold text-slate-900">{subjectName}</h1>
      <p className="text-slate-600">Browse all resources under this subject.</p>
      <SubjectProductsSection subject={subjectName} />
    </section>
  );
}
