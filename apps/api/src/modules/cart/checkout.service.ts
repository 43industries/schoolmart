import {
  prisma,
  LinkStatus,
  ProductStatus,
  VendorStatus,
} from "@schoolmart/db";
import type { CheckoutCartInput } from "@schoolmart/shared";
import { AppError, ForbiddenError } from "../../lib/errors.js";
import type { AuditContext } from "../audit/audit.service.js";
import { dominantCategory, type CartLine } from "./order-payment.service.js";
import { executeWalletCheckout } from "../wallets/wallet-spend.service.js";

export type { CartLine } from "./order-payment.service.js";
export {
  createPendingOrderFromLines,
  createPaidOrderFromLines,
  finalizeDirectOrderPayment,
  dominantCategory,
} from "./order-payment.service.js";

export async function loadCheckoutLines(
  parentUserId: string,
  schoolId: string,
  studentId: string,
): Promise<{ lines: CartLine[]; subtotalMinor: number }> {
  const cart = await prisma.cart.findFirst({
    where: { parentUserId },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendor: true,
              category: true,
              inventory: true,
              schoolProducts: { where: { schoolId, approved: true } },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!cart || cart.items.length === 0) throw new AppError(400, "Cart is empty");

  const link = await prisma.parentStudentLink.findUnique({
    where: { parentUserId_studentId: { parentUserId, studentId } },
  });
  if (!link || link.status !== LinkStatus.ACTIVE) {
    throw new ForbiddenError("Student link is not active");
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.schoolId !== schoolId) {
    throw new AppError(400, "Student does not belong to this school");
  }

  const lines: CartLine[] = [];
  for (const item of cart.items) {
    const p = item.product;
    if (p.status !== ProductStatus.ACTIVE || p.vendor.status !== VendorStatus.APPROVED) {
      throw new AppError(400, `${p.name} is not available`);
    }
    if (p.schoolProducts.length === 0) {
      throw new AppError(400, `${p.name} is not approved for this school`);
    }
    const available = (p.inventory?.availableQty ?? 0) - (p.inventory?.reservedQty ?? 0);
    if (available < item.quantity) throw new AppError(400, `Insufficient stock for ${p.name}`);
    lines.push({
      productId: p.id,
      quantity: item.quantity,
      name: p.name,
      priceMinor: p.priceMinor,
      vendorId: p.vendorId,
      categorySlug: p.category?.slug ?? null,
    });
  }

  const subtotalMinor = lines.reduce((s, l) => s + l.priceMinor * l.quantity, 0);
  return { lines, subtotalMinor };
}

export async function checkoutWithWallet(
  parentUserId: string,
  input: CheckoutCartInput,
  ctx: AuditContext,
) {
  const { lines, subtotalMinor } = await loadCheckoutLines(
    parentUserId,
    input.schoolId,
    input.studentId,
  );

  return executeWalletCheckout({
    parentUserId,
    studentId: input.studentId,
    schoolId: input.schoolId,
    lines,
    subtotalMinor,
    category: dominantCategory(lines),
    notes: input.notes,
    actorUserId: parentUserId,
    paymentRefPrefix: "wallet",
    pendingAuditAction: "WALLET_SPEND_PENDING",
    paidAuditAction: "CART_CHECKED_OUT_WALLET",
    pendingMessage: "A spending rule requires your approval before this checkout completes.",
    clearCartOnPay: true,
    ctx,
  });
}
