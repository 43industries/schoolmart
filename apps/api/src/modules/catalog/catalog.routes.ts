import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { catalogSearchSchema } from "@schoolmart/shared";
import {
  searchSchoolCatalog,
  listSchoolVendors,
  listSchoolProducts,
  listAvailableVendorsForSchool,
  approveSchoolVendor,
  approveSchoolProduct,
} from "./catalog.service.js";
import { authenticate, requireSchoolAdmin } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ForbiddenError, ValidationError } from "../../lib/errors.js";
import { getProduct } from "../products/products.service.js";
import { prisma, Role } from "@schoolmart/db";

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/search", { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = catalogSearchSchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const isParent = req.user!.roles.some((r) => r.role === Role.PARENT);
    const isStudent = req.user!.roles.some((r) => r.role === Role.STUDENT);
    if (!isParent && !isStudent) {
      throw new ForbiddenError("Parent or student access required");
    }

    if (isStudent) {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
      if (!student) throw new ForbiddenError("Student profile not found");
      if (parsed.data.schoolId !== student.schoolId) {
        throw new ForbiddenError("You can only browse your school catalog");
      }
    }

    return reply.send(await searchSchoolCatalog(parsed.data));
  });

  app.get("/products/:id", { preHandler: [authenticate] }, async (req, reply) => {
    const isParent = req.user!.roles.some((r) => r.role === Role.PARENT);
    const isStudent = req.user!.roles.some((r) => r.role === Role.STUDENT);
    if (!isParent && !isStudent) {
      throw new ForbiddenError("Parent or student access required");
    }
    const { id } = req.params as { id: string };
    return reply.send(await getProduct(id));
  });
}

export async function schoolCatalogRoutes(app: FastifyInstance) {
  app.get("/:id/catalog/vendors", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({ vendors: await listSchoolVendors(id) });
  });

  app.get("/:id/catalog/vendors/available", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({ vendors: await listAvailableVendorsForSchool(id) });
  });

  app.get("/:id/catalog/products", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({ products: await listSchoolProducts(id) });
  });

  app.post("/:id/catalog/vendors/:vendorId", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id, vendorId } = req.params as { id: string; vendorId: string };
    const body = z.object({ approved: z.boolean() }).safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed");
    const link = await approveSchoolVendor(
      id,
      vendorId,
      body.data.approved,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(link);
  });

  app.post("/:id/catalog/products/:productId", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id, productId } = req.params as { id: string; productId: string };
    const body = z.object({ approved: z.boolean() }).safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed");
    const link = await approveSchoolProduct(
      id,
      productId,
      body.data.approved,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(link);
  });
}

