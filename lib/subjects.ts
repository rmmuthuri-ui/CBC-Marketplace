/**
 * Canonical subject labels for navigation and Supabase `products.subject` filtering.
 * Category URLs use encodeURIComponent(subject).
 */
export const MARKETPLACE_SUBJECTS = [
  "Mathematics",
  "English",
  "Science & Technology",
  "Social Studies",
  "Religious Education",
  "Agriculture",
  "Home Science",
  "Optional Subjects",
] as const;

export type MarketplaceSubject = (typeof MARKETPLACE_SUBJECTS)[number];
