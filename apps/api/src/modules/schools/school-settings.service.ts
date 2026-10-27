import { prisma, Prisma } from "@schoolmart/db";
import type { PutDeliveryWindowsInput, SchoolSettingsUpdateInput } from "@schoolmart/shared";
import { NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export async function getSchoolOpsSettings(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      collectionPinRequired: true,
      settings: { select: { deliveryNotes: true, catalogPolicy: true, revenueShareBps: true } },
      deliveryWindows: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          daysOfWeek: true,
          active: true,
        },
      },
    },
  });
  if (!school) throw new NotFoundError("School not found");

  return {
    id: school.id,
    name: school.name,
    collectionPinRequired: school.collectionPinRequired,
    deliveryNotes: school.settings?.deliveryNotes ?? null,
    windows: school.deliveryWindows.map((w) => ({
      id: w.id,
      name: w.name,
      startTime: w.startTime,
      endTime: w.endTime,
      daysOfWeek: Array.isArray(w.daysOfWeek) ? (w.daysOfWeek as number[]) : [1, 2, 3, 4, 5],
      active: w.active,
    })),
  };
}

export async function updateSchoolOpsSettings(
  schoolId: string,
  input: SchoolSettingsUpdateInput,
  ctx: AuditContext,
) {
  const existing = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!existing) throw new NotFoundError("School not found");

  await prisma.$transaction(async (tx) => {
    if (input.collectionPinRequired !== undefined) {
      await tx.school.update({
        where: { id: schoolId },
        data: { collectionPinRequired: input.collectionPinRequired },
      });
    }
    if (input.deliveryNotes !== undefined) {
      await tx.schoolSettings.upsert({
        where: { schoolId },
        create: { schoolId, deliveryNotes: input.deliveryNotes },
        update: { deliveryNotes: input.deliveryNotes },
      });
    }
  });

  await writeAuditLog({
    action: "SCHOOL_SETTINGS_UPDATED",
    resourceType: "School",
    resourceId: schoolId,
    metadata: input,
    context: ctx,
  });

  return getSchoolOpsSettings(schoolId);
}

export async function replaceDeliveryWindows(
  schoolId: string,
  input: PutDeliveryWindowsInput,
  ctx: AuditContext,
) {
  const existing = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!existing) throw new NotFoundError("School not found");

  await prisma.$transaction(async (tx) => {
    await tx.deliveryWindow.deleteMany({ where: { schoolId } });
    if (input.windows.length > 0) {
      await tx.deliveryWindow.createMany({
        data: input.windows.map((w) => ({
          schoolId,
          name: w.name,
          startTime: w.startTime,
          endTime: w.endTime,
          daysOfWeek: w.daysOfWeek as Prisma.InputJsonValue,
          active: w.active,
        })),
      });
    }
  });

  await writeAuditLog({
    action: "SCHOOL_DELIVERY_WINDOWS_UPDATED",
    resourceType: "School",
    resourceId: schoolId,
    metadata: { count: input.windows.length },
    context: ctx,
  });

  return getSchoolOpsSettings(schoolId);
}
