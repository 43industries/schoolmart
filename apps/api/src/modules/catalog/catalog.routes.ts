import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { catalogSearchSchema } from "@schoolmart/shared";
import {
  searchSchoolCatalog,
  listSchoolVendors,
  listSchoolProducts,
  approveSchoolVendor,
  approveSchoolProduct,
} from "./catalog.service.js";
import { authenticate, requireParent, requireSchoolAdmin } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";
import { getProduct } from "../products/products.service.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/search", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = catalogSearchSchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    return reply.send(await searchSchoolCatalog(parsed.data));
  });

  app.get("/products/:id", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
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
