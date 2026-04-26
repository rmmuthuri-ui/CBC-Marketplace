export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = trimmed.slice(7).trim();
  return token || null;
}

export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function emailsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  return Boolean(a) && a === b;
}
