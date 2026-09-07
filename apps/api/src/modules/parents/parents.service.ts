import { prisma, LinkStatus } from "@schoolmart/db";
import type { LinkChildInput } from "@schoolmart/shared";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export async function linkChild(parentUserId: string, input: LinkChildInput, ctx: AuditContext) {
  const parentProfile = await prisma.parentProfile.findUnique({ where: { userId: parentUserId } });
  if (!parentProfile) throw new NotFoundError("Parent profile not found");

  const student = await prisma.student.findUnique({
    where: { schoolId_studentNumber: { schoolId: input.schoolId, studentNumber: input.studentNumber } },
  });
  if (!student) throw new NotFoundError("Student not found at this school");

  const existing = await prisma.parentStudentLink.findUnique({
    where: { parentUserId_studentId: { parentUserId, studentId: student.id } },
  });
  if (existing) throw new ConflictError("Link already exists");

  const link = await prisma.parentStudentLink.create({
    data: {
      parentUserId,
      studentId: student.id,
      relationship: input.relationship,
      status: LinkStatus.PENDING_SCHOOL_APPROVAL,
      consentedAt: new Date(),
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, studentNumber: true, grade: true, schoolId: true },
      },
    },
  });

  await writeAuditLog({
    action: "PARENT_LINK_REQUESTED",
    resourceType: "ParentStudentLink",
    resourceId: link.id,
    metadata: { studentId: student.id, schoolId: input.schoolId },
    context: { ...ctx, actorUserId: parentUserId },
  });

  return {
    id: link.id,
    status: link.status,
    relationship: link.relationship,
    student: link.student,
    createdAt: link.createdAt,
  };
}

export async function listParentChildren(parentUserId: string) {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          studentNumber: true,
          grade: true,
          className: true,
          boardingStatus: true,
          status: true,
          school: { select: { id: true, name: true, town: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return links.map((link) => ({
    id: link.id,
    status: link.status,
    relationship: link.relationship,
    approvedAt: link.approvedAt,
    student: link.status === LinkStatus.ACTIVE ? link.student : {
      id: link.student.id,
      firstName: link.student.firstName,
      lastName: link.student.lastName,
      studentNumber: link.student.studentNumber,
      grade: link.student.grade,
      school: link.student.school,
    },
    createdAt: link.createdAt,
  }));
}

export async function listPendingLinks(schoolId: string) {
  return prisma.parentStudentLink.findMany({
    where: {
      status: LinkStatus.PENDING_SCHOOL_APPROVAL,
      student: { schoolId },
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, grade: true } },
      parentProfile: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phoneE164: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function approveLink(linkId: string, schoolId: string, approverUserId: string, ctx: AuditContext) {
  const link = await prisma.parentStudentLink.findFirst({
    where: { id: linkId, student: { schoolId }, status: LinkStatus.PENDING_SCHOOL_APPROVAL },
  });
  if (!link) throw new NotFoundError("Pending link not found");

  const updated = await prisma.parentStudentLink.update({
    where: { id: linkId },
    data: {
      status: LinkStatus.ACTIVE,
      approvedByUserId: approverUserId,
      approvedAt: new Date(),
    },
  });

  await writeAuditLog({
    action: "PARENT_LINK_APPROVED",
    resourceType: "ParentStudentLink",
    resourceId: linkId,
    context: { ...ctx, actorUserId: approverUserId },
  });

  return updated;
}

export async function rejectLink(
  linkId: string,
  schoolId: string,
  approverUserId: string,
  reason: string | undefined,
  ctx: AuditContext,
) {
  const link = await prisma.parentStudentLink.findFirst({
    where: { id: linkId, student: { schoolId }, status: LinkStatus.PENDING_SCHOOL_APPROVAL },
  });
  if (!link) throw new NotFoundError("Pending link not found");

  const updated = await prisma.parentStudentLink.update({
    where: { id: linkId },
    data: { status: LinkStatus.REJECTED, rejectedReason: reason, approvedByUserId: approverUserId },
  });

  await writeAuditLog({
    action: "PARENT_LINK_REJECTED",
    resourceType: "ParentStudentLink",
    resourceId: linkId,
    metadata: { reason },
    context: { ...ctx, actorUserId: approverUserId },
  });

  return updated;
}
