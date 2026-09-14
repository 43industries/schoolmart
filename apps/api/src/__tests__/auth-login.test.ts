import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseLoginIdentifier, resolveLoginUser } from "../modules/auth/auth.service.js";

vi.mock("@schoolmart/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  Role: {},
  ScopeType: {},
  UserStatus: { SUSPENDED: "SUSPENDED", DISABLED: "DISABLED", ACTIVE: "ACTIVE" },
  LinkStatus: {},
}));

vi.mock("../config.js", () => ({
  config: {
    jwtSecret: "test",
    jwtAccessExpiresIn: "15m",
    jwtRefreshExpiresIn: "7d",
  },
}));

vi.mock("../lib/crypto.js", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  hashToken: vi.fn(),
  generateToken: vi.fn(),
}));

vi.mock("../modules/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

import { prisma } from "@schoolmart/db";

describe("parseLoginIdentifier", () => {
  it("resolves email identifiers to lowercase email lookup", () => {
    expect(parseLoginIdentifier("Parent1@Demo.KE")).toEqual({
      kind: "email",
      email: "parent1@demo.ke",
    });
  });

  it("resolves Kenya phone identifiers to E.164", () => {
    expect(parseLoginIdentifier("0712345001")).toEqual({
      kind: "phone",
      phone: "+254712345001",
    });
  });

  it("returns null for garbage identifiers", () => {
    expect(parseLoginIdentifier("not-a-login")).toBeNull();
    expect(parseLoginIdentifier("")).toBeNull();
    expect(parseLoginIdentifier("   ")).toBeNull();
  });
});

describe("resolveLoginUser", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.user.findFirst).mockReset();
  });

  it("looks up by email for email identifiers", async () => {
    const fakeUser = { id: "u1", email: "parent1@demo.ke" };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(fakeUser as never);

    const user = await resolveLoginUser("parent1@demo.ke");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "parent1@demo.ke" },
      include: { roles: true },
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(user).toEqual(fakeUser);
  });

  it("looks up by phoneE164 for phone identifiers", async () => {
    const fakeUser = { id: "u2", phoneE164: "+254712345001" };
    vi.mocked(prisma.user.findFirst).mockResolvedValue(fakeUser as never);

    const user = await resolveLoginUser("0712345001");
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { phoneE164: "+254712345001" },
      include: { roles: true },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(user).toEqual(fakeUser);
  });

  it("returns null for garbage identifiers without querying", async () => {
    const user = await resolveLoginUser("!!!bogus!!!");
    expect(user).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
