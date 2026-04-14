/**
 * Canonical subject labels for navigation and Supabase `products.subject` filtering.
 * Subject pages use slug routes like /subjects/mathematics.
 */
export const MARKETPLACE_SUBJECTS = [
  "Mathematics",
  "English",
  "Science & Technology",
  "Social Studies",
  "Arts",
  "Computer Studies",
  "Physical & Health Education",
  "French",
  "German",
  "Mandarin",
  "Business Studies",
  "Community Service Learning",
  "Kiswahili",
  "Religious Education",
  "Agriculture",
  "Home Science",
  "Optional Subjects",
] as const;

export type MarketplaceSubject = (typeof MARKETPLACE_SUBJECTS)[number];

export function subjectToSlug(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function subjectFromSlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  const subject = MARKETPLACE_SUBJECTS.find(
    (item) => subjectToSlug(item) === normalized,
  );
  return subject ?? null;
}
