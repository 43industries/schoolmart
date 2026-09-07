import { prisma, type Prisma } from "@schoolmart/db";
import type { FastifyRequest } from "fastify";

export interface AuditContext {
  actorUserId?: string;
  ip?: string;
  userAgent?: string;
}

export async function writeAuditLog(params: {
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  context?: AuditContext;
}) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      actorUserId: params.context?.actorUserId,
      ip: params.context?.ip,
      userAgent: params.context?.userAgent,
    },
  });
}

export function auditContextFromRequest(req: FastifyRequest, userId?: string): AuditContext {
  return {
    actorUserId: userId,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };
}
