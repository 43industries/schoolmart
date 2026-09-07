import jwt from "jsonwebtoken";
import { prisma, Role, ScopeType, UserStatus } from "@schoolmart/db";
import { normalizeKenyaPhone } from "@schoolmart/shared";
import type { RegisterInput, LoginInput } from "@schoolmart/shared";
import { config } from "../../config.js";
import { hashPassword, verifyPassword, hashToken, generateToken } from "../../lib/crypto.js";
import { AppError, ConflictError, UnauthorizedError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export interface TokenPayload {
  sub: string;
  roles: Array<{ role: Role; scopeType: ScopeType; scopeId: string | null }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const [, num, unit] = match;
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(num!, 10) * (multipliers[unit!] ?? 60);
}

export async function registerParent(input: RegisterInput, ctx: AuditContext): Promise<{ userId: string }> {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError("Email already registered");
  }
  if (input.phone) {
    const existing = await prisma.user.findUnique({ where: { phoneE164: input.phone } });
    if (existing) throw new ConflictError("Phone already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      phoneE164: input.phone,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: input.email ? new Date() : undefined,
      phoneVerifiedAt: input.phone ? new Date() : undefined,
      roles: { create: { role: Role.PARENT, scopeType: ScopeType.PLATFORM } },
      parentProfile: { create: {} },
    },
  });

  await writeAuditLog({
    action: "USER_REGISTERED",
    resourceType: "User",
    resourceId: user.id,
    metadata: { role: "PARENT" },
    context: { ...ctx, actorUserId: user.id },
  });

  return { userId: user.id };
}

export async function login(input: LoginInput, ctx: AuditContext): Promise<AuthTokens & { user: TokenPayload }> {
  const identifier = input.identifier.trim();
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        { phoneE164: normalizeKenyaPhone(identifier) ?? undefined },
      ],
    },
    include: { roles: true },
  });

  if (!user) throw new UnauthorizedError("Invalid credentials");

  if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DISABLED) {
    throw new UnauthorizedError("Account is suspended");
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) throw new UnauthorizedError("Invalid credentials");

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const payload: TokenPayload = {
    sub: user.id,
    roles: user.roles.map((r) => ({ role: r.role, scopeType: r.scopeType, scopeId: r.scopeId })),
  };

  const tokens = await createSession(user.id, payload, ctx);

  await writeAuditLog({
    action: "USER_LOGIN",
    resourceType: "User",
    resourceId: user.id,
    context: { ...ctx, actorUserId: user.id },
  });

  return { ...tokens, user: payload };
}

async function createSession(userId: string, payload: TokenPayload, ctx: AuditContext): Promise<AuthTokens> {
  const refreshToken = generateToken(48);
  const refreshTokenHash = hashToken(refreshToken);
  const expiresInSeconds = parseExpiresIn(config.jwtRefreshExpiresIn);

  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
  });

  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: parseExpiresIn(config.jwtAccessExpiresIn),
  });

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string, ctx: AuditContext): Promise<AuthTokens> {
  const refreshTokenHash = hashToken(refreshToken);
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { include: { roles: true } } },
  });

  if (!session) throw new UnauthorizedError("Invalid refresh token");

  if (session.user.status === UserStatus.SUSPENDED || session.user.status === UserStatus.DISABLED) {
    throw new UnauthorizedError("Account is suspended");
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const payload: TokenPayload = {
    sub: session.user.id,
    roles: session.user.roles.map((r) => ({ role: r.role, scopeType: r.scopeType, scopeId: r.scopeId })),
  };

  return createSession(session.user.id, payload, ctx);
}

export async function logout(refreshToken: string, userId: string, ctx: AuditContext): Promise<void> {
  const refreshTokenHash = hashToken(refreshToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    action: "USER_LOGOUT",
    resourceType: "User",
    resourceId: userId,
    context: { ...ctx, actorUserId: userId },
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export async function createAdminUser(
  input: {
    email: string;
    phone?: string;
    password: string;
    firstName: string;
    lastName: string;
    role: Role;
    scopeType: ScopeType;
    scopeId?: string;
  },
  ctx: AuditContext,
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("Email already registered");

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      phoneE164: input.phone,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: {
        create: {
          role: input.role,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
        },
      },
    },
    include: { roles: true },
  });

  await writeAuditLog({
    action: "ADMIN_USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    metadata: { role: input.role, scopeType: input.scopeType },
    context: ctx,
  });

  return user;
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true, parentProfile: true },
  });
  if (!user) throw new NotFoundError("User not found");

  return {
    id: user.id,
    email: user.email,
    phone: user.phoneE164,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    roles: user.roles.map((r) => ({
      role: r.role,
      scopeType: r.scopeType,
      scopeId: r.scopeId,
    })),
    hasParentProfile: !!user.parentProfile,
    createdAt: user.createdAt,
  };
}

export async function updateUserProfile(
  userId: string,
  input: { firstName?: string; lastName?: string },
  ctx: AuditContext,
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
  });

  await writeAuditLog({
    action: "USER_PROFILE_UPDATED",
    resourceType: "User",
    resourceId: userId,
    metadata: input,
    context: { ...ctx, actorUserId: userId },
  });

  return getUserProfile(user.id);
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return { message: "If an account exists, a reset link has been sent" };
  }

  const token = generateToken(32);
  const tokenHash = hashToken(token);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  // In production: send email with token. For dev, log it.
  if (config.isDev) {
    console.log(`[DEV] Password reset token for ${email}: ${token}`);
  }

  return { message: "If an account exists, a reset link has been sent" };
}

export async function resetPassword(token: string, newPassword: string, ctx: AuditContext): Promise<void> {
  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  if (!resetToken) throw new AppError(400, "Invalid or expired reset token");

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await writeAuditLog({
    action: "PASSWORD_RESET",
    resourceType: "User",
    resourceId: resetToken.userId,
    context: { ...ctx, actorUserId: resetToken.userId },
  });
}
