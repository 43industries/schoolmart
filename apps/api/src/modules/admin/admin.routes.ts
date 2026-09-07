import type { FastifyInstance } from "fastify";
import { prisma } from "@schoolmart/db";
import { authenticate, requireSuperAdminOrFinance } from "../../middleware/auth.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/audit-logs", { preHandler: [authenticate, requireSuperAdminOrFinance()] }, async (req, reply) => {
    const query = req.query as { page?: string; limit?: string; resourceType?: string };
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "50", 10)));
    const skip = (page - 1) * limit;

    const where = query.resourceType ? { resourceType: query.resourceType } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return reply.send({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  });
}
