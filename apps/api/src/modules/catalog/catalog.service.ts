import { prisma, ProductStatus, VendorStatus } from "@schoolmart/db";
import type { CatalogSearchInput } from "@schoolmart/shared";
import { NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export async function searchSchoolCatalog(input: CatalogSearchInput) {
  const school = await prisma.school.findUnique({ where: { id: input.schoolId } });
  if (!school) throw new NotFoundError("School not found");

  const skip = (input.page - 1) * input.limit;

  const where = {
    status: ProductStatus.ACTIVE,
    vendor: { status: VendorStatus.APPROVED },
    schoolProducts: { some: { schoolId: input.schoolId, approved: true } },
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.vendorId ? { vendorId: input.vendorId } : {}),
    ...(input.minPrice !== undefined || input.maxPrice !== undefined
      ? {
          priceMinor: {
            ...(input.minPrice !== undefined ? { gte: input.minPrice } : {}),
            ...(input.maxPrice !== undefined ? { lte: input.maxPrice } : {}),
          },
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: "insensitive" as const } },
            { description: { contains: input.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        inventory: true,
      },
      orderBy: { name: "asc" },
      skip,
      take: input.limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) },
  };
}

export async function listSchoolVendors(schoolId: string) {
  return prisma.schoolVendor.findMany({
    where: { schoolId },
    include: { vendor: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSchoolProducts(schoolId: string) {
  return prisma.schoolProduct.findMany({
    where: { schoolId },
    include: {
      product: {
        include: {
          vendor: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          inventory: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function approveSchoolVendor(schoolId: string, vendorId: string, approved: boolean, ctx: AuditContext) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new NotFoundError("Vendor not found");

  const link = await prisma.schoolVendor.upsert({
    where: { schoolId_vendorId: { schoolId, vendorId } },
    create: { schoolId, vendorId, approved },
    update: { approved },
    include: { vendor: true },
  });

  await writeAuditLog({
    action: approved ? "SCHOOL_VENDOR_APPROVED" : "SCHOOL_VENDOR_REVOKED",
    resourceType: "SchoolVendor",
    resourceId: link.id,
    metadata: { schoolId, vendorId },
    context: ctx,
  });

  return link;
}

export async function approveSchoolProduct(schoolId: string, productId: string, approved: boolean, ctx: AuditContext) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Product not found");

  const link = await prisma.schoolProduct.upsert({
    where: { schoolId_productId: { schoolId, productId } },
    create: { schoolId, productId, approved },
    update: { approved },
    include: { product: { include: { vendor: { select: { id: true, name: true } } } } },
  });

  await writeAuditLog({
    action: approved ? "SCHOOL_PRODUCT_APPROVED" : "SCHOOL_PRODUCT_REVOKED",
    resourceType: "SchoolProduct",
    resourceId: link.id,
    metadata: { schoolId, productId },
    context: ctx,
  });

  return link;
}
