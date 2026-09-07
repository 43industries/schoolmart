import { describe, it, expect } from "vitest";
import { normalizeKenyaPhone, isValidKenyaPhone, formatKES, toMinorUnits } from "@schoolmart/shared";

describe("phone utilities", () => {
  it("normalizes 07xx format", () => {
    expect(normalizeKenyaPhone("0712345678")).toBe("+254712345678");
  });

  it("normalizes +254 format", () => {
    expect(normalizeKenyaPhone("+254712345678")).toBe("+254712345678");
  });

  it("normalizes 254 format", () => {
    expect(normalizeKenyaPhone("254712345678")).toBe("+254712345678");
  });

  it("returns null for invalid", () => {
    expect(normalizeKenyaPhone("123")).toBeNull();
    expect(isValidKenyaPhone("123")).toBe(false);
  });
});

describe("money utilities", () => {
  it("formats KES", () => {
    expect(formatKES(150000)).toBe("KSh 1,500");
  });

  it("converts to minor units", () => {
    expect(toMinorUnits(1500)).toBe(150000);
  });
});
