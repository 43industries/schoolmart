import { prisma, LinkStatus, ProductStatus, StudentRequestStatus, VendorStatus } from "@schoolmart/db";
import type { StudentProductRequestInput, ReviewStudentRequestInput } from "@schoolmart/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { addCartItem } from "../cart/cart.service.js";

async function getStudentByUserId(userId: string) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new NotFoundError("Student profile not found");
  return student;
}

export async function createStudentProductRequest(
  userId: string,
  input: StudentProductRequestInput,
  ctx: AuditContext,
) {
  const student = await getStudentByUserId(userId);
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: {
      vendor: true,
      schoolProducts: { where: { schoolId: student.schoolId, approved: true } },
    },
  });
  if (!product || product.status !== ProductStatus.ACTIVE) {
    throw new NotFoundError("Product not available");
  }
  if (product.vendor.status !== VendorStatus.APPROVED || product.schoolProducts.length === 0) {
    throw new AppError(400, "Product is not approved for your school");
  }

  const request = await prisma.studentProductRequest.create({
    data: {
      studentId: student.id,
      productId: product.id,
      quantity: input.quantity,
      note: input.note,
      status: StudentRequestStatus.PENDING,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          priceMinor: true,
          vendor: { select: { id: true, name: true } },
        },
      },
    },
  });

  await writeAuditLog({
    action: "STUDENT_PRODUCT_REQUESTED",
    resourceType: "StudentProductRequest",
    resourceId: request.id,
    metadata: { productId: product.id, quantity: input.quantity },
    context: { ...ctx, actorUserId: userId },
  });

  return request;
}

export async function listStudentOwnRequests(userId: string) {
  const student = await getStudentByUserId(userId);
  return prisma.studentProductRequest.findMany({
    where: { studentId: student.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          priceMinor: true,
          vendor: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listParentStudentRequests(parentUserId: string) {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId, status: LinkStatus.ACTIVE },
    select: { studentId: true },
  });
  const studentIds = links.map((l) => l.studentId);
  if (studentIds.length === 0) return [];

  return prisma.studentProductRequest.findMany({
    where: { studentId: { in: studentIds }, status: StudentRequestStatus.PENDING },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          schoolId: true,
          school: { select: { id: true, name: true } },
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          priceMinor: true,
          vendor: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewStudentProductRequest(
  parentUserId: string,
  input: ReviewStudentRequestInput,
  ctx: AuditContext,
) {
  const request = await prisma.studentProductRequest.findUnique({
    where: { id: input.requestId },
    include: {
      student: { select: { id: true, schoolId: true } },
      product: true,
    },
  });
  if (!request) throw new NotFoundError("Request not found");
  if (request.status !== StudentRequestStatus.PENDING) {
    throw new AppError(400, "Request is not pending");
  }

  const link = await prisma.parentStudentLink.findUnique({
    where: {
      parentUserId_studentId: { parentUserId, studentId: request.studentId },
    },
  });
  if (!link || link.status !== LinkStatus.ACTIVE) {
    throw new ForbiddenError("Not authorized for this student");
  }

  if (input.action === "REJECT") {
    const updated = await prisma.studentProductRequest.update({
      where: { id: request.id },
      data: { status: StudentRequestStatus.REJECTED },
    });
    await writeAuditLog({
      action: "STUDENT_PRODUCT_REQUEST_REJECTED",
      resourceType: "StudentProductRequest",
      resourceId: request.id,
      context: { ...ctx, actorUserId: parentUserId },
    });
    return updated;
  }

  await addCartItem(parentUserId, {
    productId: request.productId,
    quantity: request.quantity,
    schoolId: request.student.schoolId,
    studentId: request.studentId,
  });

  const updated = await prisma.studentProductRequest.update({
    where: { id: request.id },
    data: { status: StudentRequestStatus.ADDED_TO_CART },
  });

  await writeAuditLog({
    action: "STUDENT_PRODUCT_REQUEST_APPROVED",
    resourceType: "StudentProductRequest",
    resourceId: request.id,
    metadata: { addedToCart: true },
    context: { ...ctx, actorUserId: parentUserId },
  });

  return updated;
}
