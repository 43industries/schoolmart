import type { FastifyRequest, FastifyReply } from "fastify";
import { Role, ScopeType } from "@schoolmart/db";
import { verifyAccessToken, type TokenPayload } from "../modules/auth/auth.service.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function authenticate(req: FastifyRequest, _reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  const cookieToken = (req.cookies as Record<string, string | undefined>)?.accessToken;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieToken;

  if (!token) throw new UnauthorizedError();

  req.user = verifyAccessToken(token);
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user) throw new UnauthorizedError();
    const hasRole = req.user.roles.some((r) => roles.includes(r.role));
    if (!hasRole) throw new ForbiddenError("Insufficient permissions");
  };
}

export function requireSchoolAdmin(schoolIdParam = "id") {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user) throw new UnauthorizedError();
    const schoolId = (req.params as Record<string, string>)[schoolIdParam];
    if (!schoolId) throw new ForbiddenError();

    const isSuperAdmin = req.user.roles.some((r) => r.role === Role.SUPER_ADMIN);
    if (isSuperAdmin) return;

    const isSchoolAdmin = req.user.roles.some(
      (r) => r.role === Role.SCHOOL_ADMIN && r.scopeType === ScopeType.SCHOOL && r.scopeId === schoolId,
    );
    if (!isSchoolAdmin) throw new ForbiddenError("Not authorized for this school");
  };
}

export function requireParent() {
  return requireRole(Role.PARENT);
}

export function requireSuperAdmin() {
  return requireRole(Role.SUPER_ADMIN);
}

export function requireSuperAdminOrFinance() {
  return requireRole(Role.SUPER_ADMIN, Role.FINANCE);
}
