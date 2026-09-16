import {
  prisma,
  LinkStatus,
  ProductStatus,
  VendorStatus,
} from "@schoolmart/db";
import type { StudentCheckoutInput } from "@schoolmart/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { AuditContext } from "../audit/audit.service.js";
import { dominantCategory, type CartLine } from "../cart/order-payment.service.js";
import { executeWalletCheckout } from "../wallets/wallet-spend.service.js";

async function resolvePrimaryParentUserId(studentId: string) {
  const link = await prisma.parentStudentLink.findFirst({
    where: { studentId, status: LinkStatus.ACTIVE },
    orderBy: { createdAt: "asc" },
  });
  if (!link) {
    throw new AppError(400, "No active parent link — ask a parent to link your account first");
  }
  return link.parentUserId;
}

async function loadStudentProductLine(
  userId: string,
  productId: string,
  quantity: number,
): Promise<{
  studentId: string;
  schoolId: string;
  parentUserId: string;
  lines: CartLine[];
  subtotalMinor: number;
}> {
  const student = await prisma.student.findFirst({ where: { userId } });
  if (!student) throw new ForbiddenError("Student profile required");
  if (!student.userId) throw new AppError(400, "Activate your student account first");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      vendor: true,
      category: true,
      inventory: true,
      schoolProducts: { where: { schoolId: student.schoolId, approved: true } },
    },
  });
  if (!product) throw new NotFoundError("Product not found");
  if (product.status !== ProductStatus.ACTIVE || product.vendor.status !== VendorStatus.APPROVED) {
    throw new AppError(400, "Product is not available");
  }
  if (product.schoolProducts.length === 0) {
    throw new AppError(400, "Product is not approved for your school");
  }
  const available = (product.inventory?.availableQty ?? 0) - (product.inventory?.reservedQty ?? 0);
  if (available < quantity) throw new AppError(400, "Insufficient stock");

  const parentUserId = await resolvePrimaryParentUserId(student.id);
  const lines: CartLine[] = [
    {
      productId: product.id,
      quantity,
      name: product.name,
      priceMinor: product.priceMinor,
      vendorId: product.vendorId,
      categorySlug: product.category?.slug ?? null,
    },
  ];
  return {
    studentId: student.id,
    schoolId: student.schoolId,
    parentUserId,
    lines,
    subtotalMinor: product.priceMinor * quantity,
  };
}

/** Student wallet-only buy-now under parent spending rules. */
export async function studentCheckoutWithWallet(
  userId: string,
  input: StudentCheckoutInput,
  ctx: AuditContext,
) {
  const { studentId, schoolId, parentUserId, lines, subtotalMinor } = await loadStudentProductLine(
    userId,
    input.productId,
    input.quantity,
  );

  return executeWalletCheckout({
    parentUserId,
    studentId,
    schoolId,
    lines,
    subtotalMinor,
    category: dominantCategory(lines),
    notes: input.notes,
    actorUserId: userId,
    paymentRefPrefix: "student-wallet",
    pendingAuditAction: "STUDENT_WALLET_SPEND_PENDING",
    paidAuditAction: "STUDENT_CHECKED_OUT_WALLET",
    pendingMessage: "A parent must approve this purchase before it completes.",
    cartSnapshotExtra: { source: "student_checkout" },
    auditMetadata: { productId: input.productId },
    ctx,
  });
}
