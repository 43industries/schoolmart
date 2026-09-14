import { prisma, ProductStatus, VendorStatus } from "@schoolmart/db";
import type { CreateProductInput, UpdateProductInput } from "@schoolmart/shared";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export async function listProducts(filters?: { vendorId?: string; status?: ProductStatus }) {
  return prisma.product.findMany({
    where: {
      vendorId: filters?.vendorId,
      status: filters?.status,
    },
    include: {
      vendor: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      inventory: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true, status: true } },
      category: { select: { id: true, name: true, slug: true } },
      inventory: true,
    },
  });
  if (!product) throw new NotFoundError("Product not found");
  return product;
}

/** When a product goes ACTIVE, queue it for schools that already approved this vendor. */
async function queueProductForSchoolVendors(productId: string, vendorId: string) {
  const schoolVendors = await prisma.schoolVendor.findMany({
    where: { vendorId, approved: true },
    select: { schoolId: true },
  });
  for (const sv of schoolVendors) {
    await prisma.schoolProduct.upsert({
      where: { schoolId_productId: { schoolId: sv.schoolId, productId } },
      create: { schoolId: sv.schoolId, productId, approved: false },
      update: {},
    });
  }
}

export async function createProduct(input: CreateProductInput, ctx: AuditContext) {
  const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
  if (!vendor) throw new NotFoundError("Vendor not found");

  const existing = await prisma.product.findUnique({
    where: { vendorId_slug: { vendorId: input.vendorId, slug: input.slug } },
  });
  if (existing) throw new ConflictError("Product slug already exists for this vendor");

  const { availableQty, lowStockThreshold, images, ...productData } = input;

  const product = await prisma.product.create({
    data: {
      ...productData,
      images: images ?? [],
      inventory: {
        create: {
          availableQty: availableQty ?? 0,
          lowStockThreshold: lowStockThreshold ?? 5,
        },
      },
    },
    include: { inventory: true, vendor: { select: { id: true, name: true } }, category: true },
  });

  if (product.status === ProductStatus.ACTIVE && vendor.status === VendorStatus.APPROVED) {
    await queueProductForSchoolVendors(product.id, product.vendorId);
  }

  await writeAuditLog({
    action: "PRODUCT_CREATED",
    resourceType: "Product",
    resourceId: product.id,
    metadata: { name: product.name, vendorId: product.vendorId },
    context: ctx,
  });

  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput, ctx: AuditContext) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Product not found");

  const { availableQty, lowStockThreshold, images, ...productData } = input;

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        ...productData,
        ...(images !== undefined ? { images } : {}),
      },
    });

    if (availableQty !== undefined || lowStockThreshold !== undefined) {
      await tx.inventory.upsert({
        where: { productId: id },
        create: {
          productId: id,
          availableQty: availableQty ?? 0,
          lowStockThreshold: lowStockThreshold ?? 5,
        },
        update: {
          ...(availableQty !== undefined ? { availableQty } : {}),
          ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
        },
      });
    }

    return tx.product.findUniqueOrThrow({
      where: { id },
      include: { inventory: true, vendor: { select: { id: true, name: true, status: true } }, category: true },
    });
  });

  const becameActive =
    product.status === ProductStatus.ACTIVE &&
    (existing.status !== ProductStatus.ACTIVE || input.status === ProductStatus.ACTIVE);
  if (becameActive && product.vendor.status === VendorStatus.APPROVED) {
    await queueProductForSchoolVendors(product.id, product.vendorId);
  }

  await writeAuditLog({
    action: "PRODUCT_UPDATED",
    resourceType: "Product",
    resourceId: id,
    metadata: input,
    context: ctx,
  });

  return product;
}

export async function assertVendorOwnsProduct(vendorId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Product not found");
  if (product.vendorId !== vendorId) throw new ForbiddenError("Not your product");
  return product;
}
