import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema, createSchoolSchema } from "@schoolmart/shared";

const child = {
  firstName: "Amina",
  lastName: "Doe",
  schoolId: "11111111-1111-1111-1111-111111111111",
  studentNumber: "GF-2024-001",
  classTeacherName: "Mrs. Wanjiku",
  relationship: "MOTHER" as const,
};

describe("registerSchema", () => {
  it("accepts email registration with child", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "Password1",
      firstName: "John",
      lastName: "Doe",
      child,
    });
    expect(result.success).toBe(true);
  });

  it("accepts phone registration with child", () => {
    const result = registerSchema.safeParse({
      phone: "0712345678",
      password: "Password1",
      firstName: "John",
      lastName: "Doe",
      child,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+254712345678");
    }
  });

  it("rejects without email or phone", () => {
    const result = registerSchema.safeParse({
      password: "Password1",
      firstName: "John",
      lastName: "Doe",
      child,
    });
    expect(result.success).toBe(false);
  });

  it("rejects without child details", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "Password1",
      firstName: "John",
      lastName: "Doe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "weak",
      firstName: "John",
      lastName: "Doe",
      child,
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid login", () => {
    const result = loginSchema.safeParse({ identifier: "test@example.com", password: "pass" });
    expect(result.success).toBe(true);
  });
});

describe("createSchoolSchema", () => {
  it("accepts valid school", () => {
    const result = createSchoolSchema.safeParse({
      name: "Test School",
      slug: "test-school",
      type: "PRIVATE_PRIMARY",
      county: "Nairobi",
      town: "Karen",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid slug", () => {
    const result = createSchoolSchema.safeParse({
      name: "Test School",
      slug: "Test School!",
      type: "PRIVATE_PRIMARY",
      county: "Nairobi",
      town: "Karen",
    });
    expect(result.success).toBe(false);
  });
});
