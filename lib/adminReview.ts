export function getAdminReviewKey(): string {
  const key = process.env.ADMIN_REVIEW_KEY?.trim();
  if (!key) {
    throw new Error("Missing required environment variable: ADMIN_REVIEW_KEY");
  }
  return key;
}

export function isValidAdminReviewKey(candidate: string | null, expected: string): boolean {
  return Boolean(candidate && candidate.trim() && candidate.trim() === expected);
}
