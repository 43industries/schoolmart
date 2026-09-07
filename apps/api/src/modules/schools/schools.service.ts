import { prisma, SchoolStatus } from "@schoolmart/db";
import type { CreateSchoolInput, UpdateSchoolInput } from "@schoolmart/shared";
import { NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export async function listPublicSchools() {
  return prisma.school.findMany({
    where: { status: SchoolStatus.ACTIVE },
    select: { id: true, name: true, town: true, county: true, type: true, boardingSupported: true },
    orderBy: { name: "asc" },
  });
}

export async function getPublicSchool(id: string) {
  const school = await prisma.school.findFirst({
    where: { id, status: SchoolStatus.ACTIVE },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      county: true,
      town: true,
      boardingSupported: true,
      collectionPinRequired: true,
    },
  });
  if (!school) throw new NotFoundError("School not found");
  return school;
}

export async function createSchool(input: CreateSchoolInput, ctx: AuditContext) {
  const school = await prisma.school.create({
    data: {
      ...input,
      status: SchoolStatus.PENDING,
      settings: { create: {} },
    },
  });

  await writeAuditLog({
    action: "SCHOOL_CREATED",
    resourceType: "School",
    resourceId: school.id,
    metadata: { name: school.name },
    context: ctx,
  });

  return school;
}

export async function updateSchool(id: string, input: UpdateSchoolInput, ctx: AuditContext) {
  const existing = await prisma.school.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("School not found");

  const school = await prisma.school.update({ where: { id }, data: input });

  await writeAuditLog({
    action: "SCHOOL_UPDATED",
    resourceType: "School",
    resourceId: id,
    metadata: input,
    context: ctx,
  });

  return school;
}

export async function listAllSchools() {
  return prisma.school.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true } } },
  });
}

export async function getSchoolById(id: string) {
  const school = await prisma.school.findUnique({
    where: { id },
    include: { settings: true, _count: { select: { students: true } } },
  });
  if (!school) throw new NotFoundError("School not found");
  return school;
}
