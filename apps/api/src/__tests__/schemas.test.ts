import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  createSchoolSchema,
  registerVendorSchema,
  registerDeliveryPartnerSchema,
  normalizeVehiclePlate,
} from "@schoolmart/shared";

const child = {
  firstName: "Amina",
  lastName: "Doe",
  schoolId: "11111111-1111-1111-1111-111111111111",
  studentNumber: "GF-2024-001",
  grade: "Grade 5",
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

describe("child middle name", () => {
  it("accepts an optional middle name and rejects over-long ones", () => {
    const ok = registerSchema.safeParse({
      email: "test@example.com",
      password: "Password1",
      firstName: "John",
      lastName: "Doe",
      child: { ...child, middleName: "Mwangi" },
    });
    expect(ok.success).toBe(true);
    const bad = registerSchema.safeParse({
      email: "test@example.com",
      password: "Password1",
      firstName: "John",
      lastName: "Doe",
      child: { ...child, middleName: "x".repeat(101) },
    });
    expect(bad.success).toBe(false);
  });
});

describe("registerVendorSchema", () => {
  const vendor = {
    businessName: "Campus Kitchen",
    firstName: "Amina",
    lastName: "Owner",
    email: "orders@campus-kitchen.co.ke",
    phone: "0712345678",
    businessContactPerson: "Amina Manager",
    businessContactPhone: "0722345678",
    password: "Password1",
    branchNetwork: "Nairobi and Thika",
    county: "Nairobi",
    town: "Westlands",
    sellCategories: ["MEALS_SNACKS" as const],
    acceptVendorTerms: true as const,
    acceptPlatformAgreement: true as const,
  };

  it("accepts business contact details and normalises a bare website domain", () => {
    const result = registerVendorSchema.safeParse({ ...vendor, website: "campus-kitchen.co.ke" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe("https://campus-kitchen.co.ke");
      expect(result.data.businessContactPhone).toBe("+254722345678");
    }
  });

  it("rejects a missing business contact telephone or invalid website", () => {
    expect(registerVendorSchema.safeParse({ ...vendor, businessContactPhone: "" }).success).toBe(false);
    expect(registerVendorSchema.safeParse({ ...vendor, website: "not a url" }).success).toBe(false);
  });
});

describe("registerDeliveryPartnerSchema", () => {
  const partner = {
    firstName: "David",
    lastName: "Driver",
    email: "driver@example.com",
    phone: "0712345678",
    password: "Password1",
    county: "Nairobi",
    town: "Karen",
    serviceTowns: "Karen",
    vehicleTypes: ["VAN" as const],
    primaryVehicleType: "VAN" as const,
    acceptTerms: true as const,
  };

  it("normalises the vehicle plate", () => {
    expect(normalizeVehiclePlate("  kcx   123a ")).toBe("KCX 123A");
    const result = registerDeliveryPartnerSchema.safeParse({ ...partner, vehiclePlateNumber: "kcx 123a" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.vehiclePlateNumber).toBe("KCX 123A");
  });

  it("rejects a primary vehicle that is not among the selected types", () => {
    const result = registerDeliveryPartnerSchema.safeParse({
      ...partner,
      vehiclePlateNumber: "KCX 123A",
      primaryVehicleType: "BODA",
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
