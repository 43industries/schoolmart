import type { FastifyInstance } from "fastify";
import { addCartItemSchema, updateCartItemSchema, checkoutCartSchema } from "@schoolmart/shared";
import { getCart, addCartItem, updateCartItem, clearCart } from "./cart.service.js";
import { authenticate, requireParent } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";
import { createCheckoutIntent } from "../payments/payments.service.js";

export async function cartRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    return reply.send(await getCart(req.user!.sub));
  });

  app.post("/items", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = addCartItemSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    return reply.status(201).send(await addCartItem(req.user!.sub, parsed.data));
  });

  app.patch("/items/:itemId", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string };
    const parsed = updateCartItemSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    return reply.send(await updateCartItem(req.user!.sub, itemId, parsed.data));
  });

  app.delete("/", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    return reply.send(await clearCart(req.user!.sub));
  });

  app.post("/checkout", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = checkoutCartSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const result = await createCheckoutIntent(
      req.user!.sub,
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    const paid = "status" in result && result.status === "PAID";
    return reply.status(paid ? 201 : 202).send(result);
  });
}
