import { describe, expect, it } from "vitest";
import { generatePassword, getTimestamp, normalizePhone } from "./mpesa";

describe("normalizePhone", () => {
  it("normalizes local Kenyan format", () => {
    expect(normalizePhone("0712345678")).toBe("254712345678");
  });

  it("normalizes format with spaces and plus sign", () => {
    expect(normalizePhone("+254 712 345 678")).toBe("254712345678");
  });

  it("throws for invalid format", () => {
    expect(() => normalizePhone("12345")).toThrowError("Invalid phone number format.");
  });
});

describe("getTimestamp", () => {
  it("returns yyyyMMddHHmmss shape", () => {
    expect(getTimestamp()).toMatch(/^\d{14}$/);
  });
});

describe("generatePassword", () => {
  it("encodes shortcode, passkey and timestamp in base64", () => {
    const password = generatePassword("174379", "passkey", "20260101010101");
    expect(password).toBe("MTc0Mzc5cGFzc2tleTIwMjYwMTAxMDEwMTAx");
  });
});
