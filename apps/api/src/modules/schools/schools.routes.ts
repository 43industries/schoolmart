import type { FastifyInstance } from "fastify";
import { createSchoolSchema, updateSchoolSchema } from "@schoolmart/shared";
import {
  listPublicSchools,
  getPublicSchool,
  createSchool,
  updateSchool,
  listAllSchools,
  getSchoolById,
} from "./schools.service.js";
import { listSchoolStudents, createStudent } from "../students/students.service.js";
import { listPendingLinks, approveLink, rejectLink } from "../parents/parents.service.js";
import { createStudentSchema } from "@schoolmart/shared";
import { authenticate, requireSuperAdmin, requireSchoolAdmin } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";
import { z } from "zod";

export async function schoolRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => {
    const schools = await listPublicSchools();
    return reply.send({ schools });
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const school = await getPublicSchool(id);
    return reply.send(school);
  });

  app.get("/:id/students", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const students = await listSchoolStudents(id);
    return reply.send({ students });
  });

  app.post("/:id/students", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = createStudentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const student = await createStudent(id, parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.status(201).send(student);
  });

  app.get("/:id/parent-links/pending", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const links = await listPendingLinks(id);
    return reply.send({ links });
  });

  app.post("/:id/parent-links/:linkId/approve", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id, linkId } = req.params as { id: string; linkId: string };
    const link = await approveLink(linkId, id, req.user!.sub, auditContextFromRequest(req, req.user!.sub));
    return reply.send(link);
  });

  app.post("/:id/parent-links/:linkId/reject", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id, linkId } = req.params as { id: string; linkId: string };
    const bodySchema = z.object({ reason: z.string().optional() });
    const parsed = bodySchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const link = await rejectLink(linkId, id, req.user!.sub, reason, auditContextFromRequest(req, req.user!.sub));
    return reply.send(link);
  });
}

export async function adminSchoolRoutes(app: FastifyInstance) {
  app.get("/schools", { preHandler: [authenticate, requireSuperAdmin()] }, async (_req, reply) => {
    const schools = await listAllSchools();
    return reply.send({ schools });
  });

  app.get("/schools/:id", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const school = await getSchoolById(id);
    return reply.send(school);
  });

  app.post("/schools", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const parsed = createSchoolSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const school = await createSchool(parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.status(201).send(school);
  });

  app.patch("/schools/:id", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSchoolSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const school = await updateSchool(id, parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.send(school);
  });
}
