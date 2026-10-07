import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { settleVendorPayoutSchema } from "@schoolmart/shared";
import { prisma, OrderStatus, DeliveryPartnerStatus } from "@schoolmart/db";
import { authenticate, requireSuperAdmin, requireSuperAdminOrFinance } from "../../middleware/auth.js";
import { auditContextFromRequest, writeAuditLog } from "../audit/audit.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import {
  listOpenVendorPayables,
  listVendorPayouts,
  settleVendorPayout,
} from "../payments/vendor-payouts.service.js";
import { listPaymentsForAdmin, reconcileOpenPayments } from "../payments/payments.reconcile.js";
import { getRefundedMinor, refundOrderToWallet } from "../orders/order-lifecycle.service.js";

const refundSchema = z.object({
  amountMinor: z.number().int().positive().optional(),
  reason: z.string().min(3).max(300),
});

const partnerStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]),
});

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

  app.get("/payouts/open", { preHandler: [authenticate, requireSuperAdminOrFinance()] }, async (_req, reply) => {
    return reply.send(await listOpenVendorPayables());
  });

  app.get("/payouts", { preHandler: [authenticate, requireSuperAdminOrFinance()] }, async (req, reply) => {
    const query = req.query as { limit?: string };
    const limit = parseInt(query.limit ?? "50", 10);
    return reply.send({ payouts: await listVendorPayouts(limit) });
  });

  app.post("/payouts/settle", { preHandler: [authenticate, requireSuperAdminOrFinance()] }, async (req, reply) => {
    const parsed = settleVendorPayoutSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const payout = await settleVendorPayout(
      parsed.data,
      req.user!.sub,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.status(201).send({ payout });
  });

  app.get("/payments", { preHandler: [authenticate, requireSuperAdminOrFinance()] }, async (req, reply) => {
    const query = req.query as { status?: string; needsReview?: string; limit?: string };
    const payments = await listPaymentsForAdmin({
      status: query.status,
      needsReview: query.needsReview === "true",
      limit: parseInt(query.limit ?? "50", 10),
    });
    return reply.send({ payments });
  });

  app.post("/payments/reconcile", { preHandler: [authenticate, requireSuperAdminOrFinance()] }, async (req, reply) => {
    const summary = await reconcileOpenPayments(100, auditContextFromRequest(req, req.user!.sub));
    return reply.send(summary);
  });

  app.get("/orders", { preHandler: [authenticate, requireSuperAdminOrFinance()] }, async (req, reply) => {
    const query = req.query as { status?: string; q?: string; limit?: string };
    const status =
      query.status && Object.values(OrderStatus).includes(query.status as OrderStatus)
        ? (query.status as OrderStatus)
        : undefined;
    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query.q ? { orderNumber: { contains: query.q.trim().toUpperCase() } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, parseInt(query.limit ?? "50", 10))),
      include: {
        vendor: { select: { id: true, name: true } },
        school: { select: { id: true, name: true } },
        student: { select: { firstName: true, lastName: true } },
        payments: { select: { method: true, status: true, provider: true } },
      },
    });
    return reply.send({ orders });
  });

  app.post("/orders/:id/refund", { preHandler: [authenticate, requireSuperAdminOrFinance()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const result = await refundOrderToWallet({
      orderId: id,
      amountMinor: parsed.data.amountMinor,
      reason: parsed.data.reason,
      actorUserId: req.user!.sub,
      ctx: auditContextFromRequest(req, req.user!.sub),
    });
    return reply.send({ ...result, refundedTotalMinor: await getRefundedMinor(id) });
  });

  app.get("/delivery-partners", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const query = req.query as { status?: string };
    const status =
      query.status && Object.values(DeliveryPartnerStatus).includes(query.status as DeliveryPartnerStatus)
        ? (query.status as DeliveryPartnerStatus)
        : undefined;
    const partners = await prisma.deliveryPartner.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true, phoneE164: true } },
        _count: { select: { batches: true } },
      },
    });
    return reply.send({ partners });
  });

  app.patch("/delivery-partners/:id", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = partnerStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const existing = await prisma.deliveryPartner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Delivery partner not found");
    const partner = await prisma.deliveryPartner.update({
      where: { id },
      data: { status: parsed.data.status as DeliveryPartnerStatus },
    });
    await writeAuditLog({
      action: "DELIVERY_PARTNER_STATUS_CHANGED",
      resourceType: "DeliveryPartner",
      resourceId: id,
      metadata: { from: existing.status, to: partner.status },
      context: auditContextFromRequest(req, req.user!.sub),
    });
    return reply.send(partner);
  });
}
