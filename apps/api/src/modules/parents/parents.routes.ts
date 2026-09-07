import type { FastifyInstance } from "fastify";
import { linkChildSchema } from "@schoolmart/shared";
import { linkChild, listParentChildren } from "./parents.service.js";
import { authenticate, requireParent } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";

export async function parentRoutes(app: FastifyInstance) {
  app.get("/children", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const children = await listParentChildren(req.user!.sub);
    return reply.send({ children });
  });

  app.post("/children/link", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = linkChildSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const link = await linkChild(req.user!.sub, parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.status(201).send(link);
  });
}
