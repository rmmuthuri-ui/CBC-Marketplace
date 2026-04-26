import { describe, expect, it } from "vitest";
import { emailsMatch, extractBearerToken, normalizeEmail } from "./auth";

describe("extractBearerToken", () => {
  it("returns token for Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("supports lowercase bearer", () => {
    expect(extractBearerToken("bearer xyz")).toBe("xyz");
  });

  it("returns null for invalid auth scheme", () => {
    expect(extractBearerToken("Basic token")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  TeSt@Example.COM ")).toBe("test@example.com");
  });
});

describe("emailsMatch", () => {
  it("matches emails case-insensitively", () => {
    expect(emailsMatch("A@Example.com", "a@example.com")).toBe(true);
  });

  it("returns false when either side is empty", () => {
    expect(emailsMatch("", "a@example.com")).toBe(false);
  });
});
