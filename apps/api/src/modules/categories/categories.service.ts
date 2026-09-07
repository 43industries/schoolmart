import { prisma } from "@schoolmart/db";
import type { CreateCategoryInput } from "@schoolmart/shared";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true, children: true } } },
  });
}

export async function createCategory(input: CreateCategoryInput, ctx: AuditContext) {
  const existing = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ConflictError("Category slug already exists");

  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new NotFoundError("Parent category not found");
  }

  const category = await prisma.category.create({ data: input });

  await writeAuditLog({
    action: "CATEGORY_CREATED",
    resourceType: "Category",
    resourceId: category.id,
    metadata: { name: category.name },
    context: ctx,
  });

  return category;
}
