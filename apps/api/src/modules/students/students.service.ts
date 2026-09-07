import { prisma } from "@schoolmart/db";
import type { CreateStudentInput } from "@schoolmart/shared";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { hashPin } from "../../lib/crypto.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { randomBytes } from "crypto";

export async function listSchoolStudents(schoolId: string) {
  return prisma.student.findMany({
    where: { schoolId },
    select: {
      id: true,
      studentNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      grade: true,
      className: true,
      boardingStatus: true,
      status: true,
      createdAt: true,
    },
    orderBy: [{ grade: "asc" }, { lastName: "asc" }],
  });
}

export async function createStudent(schoolId: string, input: CreateStudentInput, ctx: AuditContext) {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new NotFoundError("School not found");

  const existing = await prisma.student.findUnique({
    where: { schoolId_studentNumber: { schoolId, studentNumber: input.studentNumber } },
  });
  if (existing) throw new ConflictError("Student number already exists at this school");

  const collectionPinHash = input.collectionPin ? await hashPin(input.collectionPin) : undefined;

  const student = await prisma.student.create({
    data: {
      schoolId,
      studentNumber: input.studentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      preferredName: input.preferredName,
      grade: input.grade,
      className: input.className,
      boardingStatus: input.boardingStatus,
      collectionPinHash,
      qrSecret: randomBytes(16).toString("hex"),
    },
  });

  await writeAuditLog({
    action: "STUDENT_CREATED",
    resourceType: "Student",
    resourceId: student.id,
    metadata: { schoolId, studentNumber: input.studentNumber },
    context: ctx,
  });

  return {
    id: student.id,
    studentNumber: student.studentNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    grade: student.grade,
    boardingStatus: student.boardingStatus,
    status: student.status,
  };
}

export async function getStudentByNumber(schoolId: string, studentNumber: string) {
  const student = await prisma.student.findUnique({
    where: { schoolId_studentNumber: { schoolId, studentNumber } },
    select: {
      id: true,
      studentNumber: true,
      firstName: true,
      lastName: true,
      grade: true,
      boardingStatus: true,
      status: true,
    },
  });
  if (!student) throw new NotFoundError("Student not found");
  return student;
}
