import { redirect } from "next/navigation";
import { subjectFromSlug, subjectToSlug } from "@/lib/subjects";

type CategoryPageProps = {
  params: Promise<{ subject: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { subject } = await params;
  const decodedSubject = decodeURIComponent(subject);
  const normalizedSubject = subjectFromSlug(decodedSubject) ?? decodedSubject;
  const slug = subjectToSlug(normalizedSubject);

  redirect(`/subjects/${slug}`);
}
