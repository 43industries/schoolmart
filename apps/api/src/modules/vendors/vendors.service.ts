import { prisma, VendorStatus, Role, ScopeType, UserStatus } from "@schoolmart/db";
import type { CreateVendorInput, UpdateVendorInput, RegisterVendorInput } from "@schoolmart/shared";
import { VENDOR_TERMS_VERSION, PLATFORM_AGREEMENT_VERSION } from "@schoolmart/shared";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { hashPassword } from "../../lib/crypto.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueVendorSlug(baseName: string): Promise<string> {
  const base = slugify(baseName) || "vendor";
  let slug = base;
  let i = 1;
  while (await prisma.vendor.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

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

export async function registerVendor(input: RegisterVendorInput, ctx: AuditContext) {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError("Email already registered");
  }
  if (input.phone) {
    const existing = await prisma.user.findUnique({ where: { phoneE164: input.phone } });
    if (existing) throw new ConflictError("Phone already registered");
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueVendorSlug(input.businessName);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        phoneE164: input.phone,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: input.email ? now : undefined,
        phoneVerifiedAt: input.phone ? now : undefined,
        roles: {
          create: { role: Role.VENDOR, scopeType: ScopeType.PLATFORM },
        },
      },
    });

    const vendor = await tx.vendor.create({
      data: {
        name: input.businessName,
        slug,
        description: input.description,
        contactEmail: input.email,
        contactPhone: input.phone,
        ownerUserId: user.id,
        county: input.county,
        town: input.town,
        addressLine: input.addressLine,
        sellCategories: input.sellCategories,
        termsVersion: VENDOR_TERMS_VERSION,
        termsAcceptedAt: now,
        agreementVersion: PLATFORM_AGREEMENT_VERSION,
        agreementAcceptedAt: now,
        status: VendorStatus.PENDING,
      },
    });

    await tx.userRole.updateMany({
      where: { userId: user.id, role: Role.VENDOR },
      data: { scopeType: ScopeType.VENDOR, scopeId: vendor.id },
    });

    return { user, vendor };
  });

  await writeAuditLog({
    action: "VENDOR_REGISTERED",
    resourceType: "Vendor",
    resourceId: result.vendor.id,
    metadata: { name: result.vendor.name, categories: input.sellCategories },
    context: { ...ctx, actorUserId: result.user.id },
  });

  return {
    userId: result.user.id,
    vendorId: result.vendor.id,
    status: result.vendor.status,
  };
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
