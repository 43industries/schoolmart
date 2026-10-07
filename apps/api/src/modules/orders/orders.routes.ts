import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OrderStatus } from "@schoolmart/db";
import {
  authenticate,
  getDeliveryPartnerIdFromUser,
  getVendorIdFromUser,
  requireDriver,
  requireParent,
  requireSchoolAdmin,
  requireVendor,
} from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ForbiddenError, ValidationError } from "../../lib/errors.js";
import type { TokenPayload } from "../auth/auth.service.js";
import { cancelOrderByParent } from "./order-lifecycle.service.js";
import {
  VENDOR_SETTABLE_STATUSES,
  acceptDriverJob,
  deliverBatch,
  failBatch,
  getDriverProfile,
  handoverAtDesk,
  listDriverBatches,
  listDriverJobs,
  listParentOrders,
  listSchoolOrders,
  listVendorOrders,
  markSchoolOrdersReady,
  pickupBatch,
  receiveSchoolOrders,
  rejectVendorOrder,
  updateVendorOrderStatus,
} from "./orders.service.js";

const orderIdsSchema = z.object({ orderIds: z.array(z.string().uuid()).min(1).max(200) });
const reasonSchema = z.object({ reason: z.string().min(3).max(300) });
const vendorStatusSchema = z.object({
  status: z.enum(VENDOR_SETTABLE_STATUSES as [OrderStatus, ...OrderStatus[]]),
});
const handoverSchema = z.object({ collectionPin: z.string().min(4).max(6) });
const deliverSchema = z.object({
  recipientName: z.string().min(2).max(120),
  notes: z.string().max(500).optional(),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
  return parsed.data;
}

function vendorIdOf(user: TokenPayload) {
  const id = getVendorIdFromUser(user);
  if (!id) throw new ForbiddenError("Vendor scope missing");
  return id;
}

function partnerIdOf(user: TokenPayload) {
  const id = getDeliveryPartnerIdFromUser(user);
  if (!id) throw new ForbiddenError("Delivery partner scope missing");
  return id;
}

export async function orderRoutes(app: FastifyInstance) {
  // Parent
  app.get("/mine", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    return reply.send({ orders: await listParentOrders(req.user!.sub) });
  });

  app.post("/mine/:id/cancel", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await cancelOrderByParent(req.user!.sub, id, auditContextFromRequest(req, req.user!.sub));
    return reply.send(result);
  });

  // Vendor
  app.get("/vendor", { preHandler: [authenticate, requireVendor()] }, async (req, reply) => {
    const { view } = req.query as { view?: string };
    const orders = await listVendorOrders(vendorIdOf(req.user!), view === "history" ? "history" : "active");
    return reply.send({ orders });
  });

  app.post("/vendor/:id/status", { preHandler: [authenticate, requireVendor()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = parse(vendorStatusSchema, req.body);
    const result = await updateVendorOrderStatus({
      vendorId: vendorIdOf(req.user!),
      orderId: id,
      status,
      actorUserId: req.user!.sub,
      ctx: auditContextFromRequest(req, req.user!.sub),
    });
    return reply.send(result);
  });

  app.post("/vendor/:id/reject", { preHandler: [authenticate, requireVendor()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = parse(reasonSchema, req.body);
    const result = await rejectVendorOrder({
      vendorId: vendorIdOf(req.user!),
      orderId: id,
      reason,
      actorUserId: req.user!.sub,
      ctx: auditContextFromRequest(req, req.user!.sub),
    });
    return reply.send(result);
  });

  // School
  app.get("/school/:id", { preHandler: [authenticate, requireSchoolAdmin("id")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send(await listSchoolOrders(id));
  });

  app.post("/school/:id/receive", { preHandler: [authenticate, requireSchoolAdmin("id")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { orderIds } = parse(orderIdsSchema, req.body);
    return reply.send(
      await receiveSchoolOrders({
        schoolId: id,
        orderIds,
        actorUserId: req.user!.sub,
        ctx: auditContextFromRequest(req, req.user!.sub),
      }),
    );
  });

  app.post("/school/:id/ready", { preHandler: [authenticate, requireSchoolAdmin("id")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { orderIds } = parse(orderIdsSchema, req.body);
    return reply.send(
      await markSchoolOrdersReady({
        schoolId: id,
        orderIds,
        actorUserId: req.user!.sub,
        ctx: auditContextFromRequest(req, req.user!.sub),
      }),
    );
  });

  app.post(
    "/school/:id/handover/:orderId",
    {
      preHandler: [authenticate, requireSchoolAdmin("id")],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const { id, orderId } = req.params as { id: string; orderId: string };
      const { collectionPin } = parse(handoverSchema, req.body);
      return reply.send(
        await handoverAtDesk({
          schoolId: id,
          orderId,
          collectionPin,
          actorUserId: req.user!.sub,
          ctx: auditContextFromRequest(req, req.user!.sub),
        }),
      );
    },
  );

  // Driver
  app.get("/driver/me", { preHandler: [authenticate, requireDriver()] }, async (req, reply) => {
    return reply.send(await getDriverProfile(partnerIdOf(req.user!)));
  });

  app.get("/driver/jobs", { preHandler: [authenticate, requireDriver()] }, async (req, reply) => {
    return reply.send({ jobs: await listDriverJobs(partnerIdOf(req.user!)) });
  });

  app.post("/driver/jobs/accept", { preHandler: [authenticate, requireDriver()] }, async (req, reply) => {
    const { schoolId } = parse(z.object({ schoolId: z.string().uuid() }), req.body);
    const batch = await acceptDriverJob({
      partnerId: partnerIdOf(req.user!),
      schoolId,
      actorUserId: req.user!.sub,
      ctx: auditContextFromRequest(req, req.user!.sub),
    });
    return reply.status(201).send(batch);
  });

  app.get("/driver/batches", { preHandler: [authenticate, requireDriver()] }, async (req, reply) => {
    return reply.send({ batches: await listDriverBatches(partnerIdOf(req.user!)) });
  });

  app.post("/driver/batches/:id/pickup", { preHandler: [authenticate, requireDriver()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send(
      await pickupBatch({
        partnerId: partnerIdOf(req.user!),
        batchId: id,
        actorUserId: req.user!.sub,
        ctx: auditContextFromRequest(req, req.user!.sub),
      }),
    );
  });

  app.post("/driver/batches/:id/deliver", { preHandler: [authenticate, requireDriver()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(deliverSchema, req.body);
    return reply.send(
      await deliverBatch({
        partnerId: partnerIdOf(req.user!),
        batchId: id,
        recipientName: body.recipientName,
        notes: body.notes,
        actorUserId: req.user!.sub,
        ctx: auditContextFromRequest(req, req.user!.sub),
      }),
    );
  });

  app.post("/driver/batches/:id/fail", { preHandler: [authenticate, requireDriver()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = parse(reasonSchema, req.body);
    return reply.send(
      await failBatch({
        partnerId: partnerIdOf(req.user!),
        batchId: id,
        reason,
        actorUserId: req.user!.sub,
        ctx: auditContextFromRequest(req, req.user!.sub),
      }),
    );
  });
}
