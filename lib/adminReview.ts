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

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, chunk) => {
    const [rawKey, ...rest] = chunk.trim().split("=");
    if (!rawKey) {
      return acc;
    }
    acc[rawKey] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

export function getAdminKeyFromRequest(request: Request): string | null {
  const headerKey = request.headers.get("x-admin-key")?.trim();
  if (headerKey) {
    return headerKey;
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies.admin_review_key?.trim() || null;
}
