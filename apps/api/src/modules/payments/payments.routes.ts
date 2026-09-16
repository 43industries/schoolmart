import type { FastifyInstance } from "fastify";
import { completePaymentSchema } from "@schoolmart/shared";
import { authenticate, requireParent } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";
import { completeIntent, handleProviderWebhook } from "./payments.service.js";

export async function paymentRoutes(app: FastifyInstance) {
  app.post("/mock/complete", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = completePaymentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const result = await completeIntent(
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(result);
  });

  app.post("/webhooks/:provider", async (req, reply) => {
    const { provider } = req.params as { provider: string };
    await handleProviderWebhook(provider, req.body, auditContextFromRequest(req));
    // Daraja expects a simple ack; other providers get the same shape
    return reply.send({ ResultCode: 0, ResultDesc: "Accepted" });
  });
}
