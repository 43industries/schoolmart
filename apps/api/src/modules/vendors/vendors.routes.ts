import type { FastifyInstance } from "fastify";
import {
  createVendorSchema,
  updateVendorSchema,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
} from "@schoolmart/shared";
import { listVendors, getVendor, createVendor, updateVendor } from "./vendors.service.js";
import { listCategories, createCategory } from "../categories/categories.service.js";
import { listProducts, getProduct, createProduct, updateProduct } from "../products/products.service.js";
import { authenticate, requireSuperAdmin } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";
import { VendorStatus, ProductStatus } from "@schoolmart/db";

export async function adminMarketplaceRoutes(app: FastifyInstance) {
  app.get("/vendors", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const query = req.query as { status?: string };
    const status = query.status && Object.values(VendorStatus).includes(query.status as VendorStatus)
      ? (query.status as VendorStatus)
      : undefined;
    const vendors = await listVendors(status);
    return reply.send({ vendors });
  });

  app.get("/vendors/:id", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send(await getVendor(id));
  });

  app.post("/vendors", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const parsed = createVendorSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const vendor = await createVendor(parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.status(201).send(vendor);
  });

  app.patch("/vendors/:id", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateVendorSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    return reply.send(await updateVendor(id, parsed.data, auditContextFromRequest(req, req.user!.sub)));
  });

  app.get("/categories", { preHandler: [authenticate, requireSuperAdmin()] }, async (_req, reply) => {
    return reply.send({ categories: await listCategories() });
  });

  app.post("/categories", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const category = await createCategory(parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.status(201).send(category);
  });

  app.get("/products", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const query = req.query as { vendorId?: string; status?: string };
    const status = query.status && Object.values(ProductStatus).includes(query.status as ProductStatus)
      ? (query.status as ProductStatus)
      : undefined;
    const products = await listProducts({ vendorId: query.vendorId, status });
    return reply.send({ products });
  });

  app.get("/products/:id", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send(await getProduct(id));
  });

  app.post("/products", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const product = await createProduct(parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.status(201).send(product);
  });

  app.patch("/products/:id", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    return reply.send(await updateProduct(id, parsed.data, auditContextFromRequest(req, req.user!.sub)));
  });
}

export async function publicCatalogRoutes(app: FastifyInstance) {
  app.get("/categories", async (_req, reply) => {
    return reply.send({ categories: await listCategories() });
  });
}
