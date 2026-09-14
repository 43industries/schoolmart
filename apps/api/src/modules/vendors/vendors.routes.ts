import type { FastifyInstance } from "fastify";
import {
  createVendorSchema,
  updateVendorSchema,
  registerVendorSchema,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  vendorCreateProductSchema,
  vendorUpdateProductSchema,
} from "@schoolmart/shared";
import { listVendors, getVendor, createVendor, updateVendor, registerVendor } from "./vendors.service.js";
import { listCategories, createCategory } from "../categories/categories.service.js";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  assertVendorOwnsProduct,
} from "../products/products.service.js";
import {
  authenticate,
  requireSuperAdmin,
  requireVendor,
  getVendorIdFromUser,
} from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ForbiddenError, ValidationError, AppError } from "../../lib/errors.js";
import { VendorStatus, ProductStatus, prisma } from "@schoolmart/db";
import type { TokenPayload } from "../auth/auth.service.js";
import { saveProductImage } from "../uploads/uploads.service.js";

export async function publicVendorRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const parsed = registerVendorSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const result = await registerVendor(parsed.data, auditContextFromRequest(req));
    return reply.status(201).send({
      success: true,
      ...result,
      message: "Vendor application submitted. Log in after approval to manage your catalog.",
    });
  });
}

function resolveVendorId(user: TokenPayload) {
  const fromJwt = getVendorIdFromUser(user);
  if (fromJwt) return fromJwt;
  throw new ForbiddenError("Vendor scope missing");
}

export async function vendorCatalogRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [authenticate, requireVendor()] }, async (req, reply) => {
    const vendorId = resolveVendorId(req.user!);
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { _count: { select: { products: true } } },
    });
    if (!vendor) throw new ForbiddenError("Vendor not found");
    return reply.send(vendor);
  });

  app.get("/me/products", { preHandler: [authenticate, requireVendor()] }, async (req, reply) => {
    const vendorId = resolveVendorId(req.user!);
    const products = await listProducts({ vendorId });
    return reply.send({ products });
  });

  app.post("/me/products/images", { preHandler: [authenticate, requireVendor()] }, async (req, reply) => {
    resolveVendorId(req.user!);
    const file = await req.file();
    if (!file) throw new AppError(400, "Choose an image file to upload");

    const buffer = await file.toBuffer();
    const saved = await saveProductImage({
      buffer,
      mimetype: file.mimetype,
      originalFilename: file.filename,
    });
    return reply.status(201).send(saved);
  });

  app.post("/me/products", { preHandler: [authenticate, requireVendor()] }, async (req, reply) => {
    const vendorId = resolveVendorId(req.user!);
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new ForbiddenError("Vendor not found");
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new ForbiddenError("Vendor must be approved before posting products");
    }

    const parsed = vendorCreateProductSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const product = await createProduct(
      { ...parsed.data, vendorId },
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.status(201).send(product);
  });

  app.patch("/me/products/:id", { preHandler: [authenticate, requireVendor()] }, async (req, reply) => {
    const vendorId = resolveVendorId(req.user!);
    const { id } = req.params as { id: string };
    await assertVendorOwnsProduct(vendorId, id);

    const parsed = vendorUpdateProductSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const product = await updateProduct(id, parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.send(product);
  });
}

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
