import { prisma, Role, ScopeType, UserStatus, OrderStatus } from "@schoolmart/db";
import type { ActivateStudentInput, ConfirmCollectionInput } from "@schoolmart/shared";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../lib/errors.js";
import { hashPassword, verifyPin } from "../../lib/crypto.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { ensureWalletForStudent } from "../wallets/wallets.service.js";

async function getStudentForUser(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      school: { select: { id: true, name: true, town: true } },
      wallet: {
        include: {
          rules: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!student) throw new NotFoundError("Student profile not found");
  return student;
}

export async function activateStudent(input: ActivateStudentInput, ctx: AuditContext) {
  const student = await prisma.student.findUnique({
    where: {
      schoolId_studentNumber: {
        schoolId: input.schoolId,
        studentNumber: input.studentNumber,
      },
    },
  });
  if (!student) throw new NotFoundError("Student not found at this school. Check the admission number.");
  if (student.userId) throw new ConflictError("This student account is already activated");
  if (!student.collectionPinHash) {
    throw new ForbiddenError("Collection PIN is not set for this student. Ask your school admin.");
  }

  const pinOk = await verifyPin(student.collectionPinHash, input.collectionPin);
  if (!pinOk) throw new UnauthorizedError("Invalid collection PIN");

  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError("Email already registered");
  }
  if (input.phone) {
    const existing = await prisma.user.findUnique({ where: { phoneE164: input.phone } });
    if (existing) throw new ConflictError("Phone already registered");
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        phoneE164: input.phone,
        passwordHash,
        firstName: student.firstName,
        lastName: student.lastName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: input.email ? now : undefined,
        phoneVerifiedAt: input.phone ? now : undefined,
        roles: {
          create: {
            role: Role.STUDENT,
            scopeType: ScopeType.SCHOOL,
            scopeId: student.schoolId,
          },
        },
      },
    });

    const updated = await tx.student.update({
      where: { id: student.id },
      data: { userId: user.id },
    });

    return { user, student: updated };
  });

  await ensureWalletForStudent(student.id);

  await writeAuditLog({
    action: "STUDENT_ACTIVATED",
    resourceType: "Student",
    resourceId: student.id,
    metadata: { schoolId: input.schoolId, studentNumber: input.studentNumber },
    context: { ...ctx, actorUserId: result.user.id },
  });

  return {
    userId: result.user.id,
    studentId: student.id,
    schoolId: student.schoolId,
  };
}

export async function getStudentMe(userId: string) {
  const student = await getStudentForUser(userId);
  return {
    id: student.id,
    studentNumber: student.studentNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    preferredName: student.preferredName,
    grade: student.grade,
    className: student.className,
    boardingStatus: student.boardingStatus,
    status: student.status,
    school: student.school,
  };
}

export async function getStudentWallet(userId: string) {
  const student = await getStudentForUser(userId);
  const wallet = student.wallet ?? (await ensureWalletForStudent(student.id));

  const full = await prisma.wallet.findUniqueOrThrow({
    where: { id: wallet.id },
    include: {
      rules: { orderBy: { createdAt: "asc" } },
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  return {
    studentId: student.id,
    balanceMinor: full.balanceMinor,
    currency: full.currency,
    rules: full.rules.map((r) => ({
      id: r.id,
      category: r.category,
      period: r.period,
      limitMinor: r.limitMinor,
      requiresApproval: r.requiresApproval,
    })),
    transactions: full.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountMinor: t.amountMinor,
      balanceAfterMinor: t.balanceAfterMinor,
      description: t.description,
      createdAt: t.createdAt,
    })),
  };
}

const COLLECTION_STATUSES: OrderStatus[] = [
  OrderStatus.IN_TRANSIT,
  OrderStatus.RECEIVED_BY_SCHOOL,
  OrderStatus.READY_FOR_COLLECTION,
  OrderStatus.COLLECTED,
  OrderStatus.COMPLETED,
];

export async function listStudentCollections(userId: string) {
  const student = await getStudentForUser(userId);
  const orders = await prisma.order.findMany({
    where: {
      studentId: student.id,
      status: { in: COLLECTION_STATUSES },
    },
    include: {
      items: {
        select: { id: true, productName: true, quantity: true, totalMinor: true },
      },
      vendor: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalMinor: o.totalMinor,
    currency: o.currency,
    deliveryDate: o.deliveryDate,
    vendor: o.vendor,
    items: o.items,
    canCollect: o.status === OrderStatus.READY_FOR_COLLECTION,
    updatedAt: o.updatedAt,
  }));
}

export async function confirmStudentCollection(
  userId: string,
  input: ConfirmCollectionInput,
  ctx: AuditContext,
) {
  const student = await getStudentForUser(userId);
  if (!student.collectionPinHash) throw new ForbiddenError("Collection PIN is not configured");

  const pinOk = await verifyPin(student.collectionPinHash, input.collectionPin);
  if (!pinOk) throw new UnauthorizedError("Invalid collection PIN");

  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      studentId: student.id,
      status: OrderStatus.READY_FOR_COLLECTION,
    },
  });
  if (!order) throw new NotFoundError("Order not ready for collection");

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.COLLECTED },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: OrderStatus.READY_FOR_COLLECTION,
        toStatus: OrderStatus.COLLECTED,
        actorUserId: userId,
        note: "Collected by student",
      },
    });
    return next;
  });

  await writeAuditLog({
    action: "ORDER_COLLECTED",
    resourceType: "Order",
    resourceId: order.id,
    metadata: { studentId: student.id },
    context: { ...ctx, actorUserId: userId },
  });

  return {
    id: updated.id,
    orderNumber: updated.orderNumber,
    status: updated.status,
  };
}
