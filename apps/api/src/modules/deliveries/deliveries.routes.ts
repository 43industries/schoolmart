import type { FastifyInstance } from "fastify";
import { registerDeliveryPartnerSchema } from "@schoolmart/shared";
import { registerDeliveryPartner } from "./deliveries.service.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";

export async function publicDeliveryRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const parsed = registerDeliveryPartnerSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const result = await registerDeliveryPartner(parsed.data, auditContextFromRequest(req));
    return reply.status(201).send({
      success: true,
      ...result,
      message:
        "Delivery partner application submitted. Log in after approval to manage deliveries near schools.",
    });
  });
}
