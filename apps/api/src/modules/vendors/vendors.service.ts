import { prisma, VendorStatus } from "@schoolmart/db";
import type { CreateVendorInput, UpdateVendorInput } from "@schoolmart/shared";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export async function listVendors(status?: VendorStatus) {
  return prisma.vendor.findMany({
    where: status ? { status } : undefined,
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getVendor(id: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: { _count: { select: { products: true } }, schoolVendors: true },
  });
  if (!vendor) throw new NotFoundError("Vendor not found");
  return vendor;
}

export async function createVendor(input: CreateVendorInput, ctx: AuditContext) {
  const existing = await prisma.vendor.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ConflictError("Vendor slug already exists");

  const vendor = await prisma.vendor.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      status: VendorStatus.PENDING,
    },
  });

  await writeAuditLog({
    action: "VENDOR_CREATED",
    resourceType: "Vendor",
    resourceId: vendor.id,
    metadata: { name: vendor.name },
    context: ctx,
  });

  return vendor;
}

export async function updateVendor(id: string, input: UpdateVendorInput, ctx: AuditContext) {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Vendor not found");

  const vendor = await prisma.vendor.update({ where: { id }, data: input });

  await writeAuditLog({
    action: "VENDOR_UPDATED",
    resourceType: "Vendor",
    resourceId: id,
    metadata: input,
    context: ctx,
  });

  return vendor;
}
