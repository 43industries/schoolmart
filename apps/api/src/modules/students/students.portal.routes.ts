import type { FastifyInstance } from "fastify";
import {
  activateStudentSchema,
  confirmCollectionSchema,
} from "@schoolmart/shared";
import { authenticate, requireStudent } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";
import {
  activateStudent,
  getStudentMe,
  getStudentWallet,
  listStudentCollections,
  confirmStudentCollection,
} from "./students.portal.service.js";

export async function publicStudentRoutes(app: FastifyInstance) {
  app.post("/activate", async (req, reply) => {
    const parsed = activateStudentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const result = await activateStudent(parsed.data, auditContextFromRequest(req));
    return reply.status(201).send({
      success: true,
      ...result,
      message: "Student account activated. You can now log in.",
    });
  });
}

export async function studentPortalRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [authenticate, requireStudent()] }, async (req, reply) => {
    const student = await getStudentMe(req.user!.sub);
    return reply.send(student);
  });

  app.get("/me/wallet", { preHandler: [authenticate, requireStudent()] }, async (req, reply) => {
    const wallet = await getStudentWallet(req.user!.sub);
    return reply.send(wallet);
  });

  app.get("/me/collections", { preHandler: [authenticate, requireStudent()] }, async (req, reply) => {
    const collections = await listStudentCollections(req.user!.sub);
    return reply.send({ collections });
  });

  app.post("/me/collections/confirm", { preHandler: [authenticate, requireStudent()] }, async (req, reply) => {
    const parsed = confirmCollectionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const result = await confirmStudentCollection(
      req.user!.sub,
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(result);
  });
}
