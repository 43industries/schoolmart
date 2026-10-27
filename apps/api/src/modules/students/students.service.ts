import { prisma } from "@schoolmart/db";
import type { CreateStudentInput, ResetStudentPinInput } from "@schoolmart/shared";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { hashPin } from "../../lib/crypto.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { randomBytes } from "crypto";

export function buildCollectionQrToken(studentId: string, qrSecret: string) {
  return `schoolmart:collect:${studentId}:${qrSecret}`;
}

export function parseCollectionQrToken(token: string): { studentId: string; secret: string } | null {
  const trimmed = token.trim();
  const prefix = "schoolmart:collect:";
  if (!trimmed.startsWith(prefix)) return null;
  const rest = trimmed.slice(prefix.length);
  const sep = rest.indexOf(":");
  if (sep <= 0) return null;
  const studentId = rest.slice(0, sep);
  const secret = rest.slice(sep + 1);
  if (!studentId || !secret) return null;
  return { studentId, secret };
}

export function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function listSchoolStudents(schoolId: string) {
  return prisma.student.findMany({
    where: { schoolId },
    select: {
      id: true,
      studentNumber: true,
      firstName: true,
      middleName: true,
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
      middleName: input.middleName || undefined,
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
    middleName: student.middleName,
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
      middleName: true,
      lastName: true,
      grade: true,
      boardingStatus: true,
      status: true,
    },
  });
  if (!student) throw new NotFoundError("Student not found");
  return student;
}

/** School admin resets collection PIN and rotates QR secret. */
export async function resetStudentCollectionCredentials(
  schoolId: string,
  studentId: string,
  input: ResetStudentPinInput,
  ctx: AuditContext,
) {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw new NotFoundError("Student not found");

  const collectionPinHash = await hashPin(input.collectionPin);
  const qrSecret = randomBytes(16).toString("hex");

  await prisma.student.update({
    where: { id: studentId },
    data: { collectionPinHash, qrSecret },
  });

  await writeAuditLog({
    action: "STUDENT_COLLECTION_CREDENTIALS_RESET",
    resourceType: "Student",
    resourceId: studentId,
    metadata: { schoolId, rotatedQr: true },
    context: ctx,
  });

  return { id: studentId, ok: true as const };
}
