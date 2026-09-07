import { prisma } from "@schoolmart/db";
import { ForbiddenError } from "../lib/errors.js";

export async function requireParentOfStudent(parentUserId: string, studentId: string): Promise<void> {
  const link = await prisma.parentStudentLink.findFirst({
    where: { parentUserId, studentId, status: "ACTIVE" },
  });
  if (!link) throw new ForbiddenError("Not authorized to access this student");
}

export async function getActiveParentStudentIds(parentUserId: string): Promise<string[]> {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId, status: "ACTIVE" },
    select: { studentId: true },
  });
  return links.map((l) => l.studentId);
}
