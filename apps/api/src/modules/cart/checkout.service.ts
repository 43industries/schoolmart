import {
  prisma,
  LinkStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  VendorStatus,
  WalletSpendStatus,
} from "@schoolmart/db";
import type { CheckoutCartInput, ApproveWalletSpendInput } from "@schoolmart/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { ensureWalletForStudent } from "../wallets/wallets.service.js";
import { getCart, clearCart } from "./cart.service.js";
import { randomUUID } from "node:crypto";

type CartLine = {
  productId: string;
  quantity: number;
  name: string;
  priceMinor: number;
  vendorId: string;
  categorySlug: string | null;
};

function periodStart(period: string): Date {
  const now = new Date();
  if (period === "DAILY") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "WEEKLY") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function mapCategory(slug: string | null): string {
  if (!slug) return "ALL";
  const s = slug.toLowerCase();
  if (s.includes("meal") || s.includes("snack") || s.includes("food")) return "MEALS_SNACKS";
  if (s.includes("suppl") || s.includes("station")) return "SCHOOL_SUPPLIES";
  if (s.includes("care") || s.includes("personal")) return "PERSONAL_CARE";
  if (s.includes("package")) return "CARE_PACKAGES";
  if (s.includes("exam")) return "EXAM_ESSENTIALS";
  if (s.includes("campus")) return "CAMPUS_ESSENTIALS";
  return "ALL";
}

export async function evaluateWalletSpend(studentId: string, amountMinor: number, category: string) {
  const wallet = await ensureWalletForStudent(studentId);
  const full = await prisma.wallet.findUniqueOrThrow({
    where: { id: wallet.id },
    include: { rules: true },
  });

  if (full.balanceMinor < amountMinor) {
    return {
      ok: false as const,
      reason: "Insufficient wallet balance",
      requiresApproval: false,
      walletId: full.id,
      balanceMinor: full.balanceMinor,
    };
  }

  const applicable = full.rules.filter((r) => r.category === "ALL" || r.category === category);
  let requiresApproval = false;

  for (const rule of applicable) {
    if (rule.requiresApproval) requiresApproval = true;
    const start = periodStart(rule.period);
    const spent = await prisma.walletTransaction.aggregate({
      where: {
        walletId: full.id,
        type: "DEBIT_SPEND",
        createdAt: { gte: start },
      },
      _sum: { amountMinor: true },
    });
    const used = spent._sum.amountMinor ?? 0;
    if (used + amountMinor > rule.limitMinor) {
      return {
        ok: false as const,
        reason: `Spending limit exceeded for ${rule.category} (${rule.period.toLowerCase()})`,
        requiresApproval: false,
        walletId: full.id,
        balanceMinor: full.balanceMinor,
      };
    }
  }

  return {
    ok: true as const,
    requiresApproval,
    walletId: full.id,
    balanceMinor: full.balanceMinor,
  };
}

export async function debitWalletSpend(opts: {
  studentId: string;
  amountMinor: number;
  description: string;
  referenceId: string;
}) {
  const wallet = await ensureWalletForStudent(opts.studentId);
  return prisma.$transaction(async (tx) => {
    const current = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    if (current.balanceMinor < opts.amountMinor) {
      throw new AppError(400, "Insufficient wallet balance");
    }
    const balanceAfter = current.balanceMinor - opts.amountMinor;
    const next = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: balanceAfter },
    });
    const row = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEBIT_SPEND",
        amountMinor: opts.amountMinor,
        balanceAfterMinor: balanceAfter,
        description: opts.description,
        referenceId: opts.referenceId,
      },
    });
    return { wallet: next, transaction: row };
  });
}

async function loadCheckoutLines(parentUserId: string, schoolId: string, studentId: string): Promise<{
  lines: CartLine[];
  subtotalMinor: number;
}> {
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

function dominantCategory(lines: CartLine[]): string {
  const counts = new Map<string, number>();
  for (const l of lines) {
    const cat = mapCategory(l.categorySlug);
    counts.set(cat, (counts.get(cat) ?? 0) + l.priceMinor * l.quantity);
  }
  let best = "ALL";
  let max = 0;
  for (const [k, v] of counts) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

async function createPaidOrderFromLines(opts: {
  parentUserId: string;
  studentId: string;
  schoolId: string;
  lines: CartLine[];
  subtotalMinor: number;
  notes?: string;
  paymentRef: string;
}) {
  const vendorId = opts.lines[0]?.vendorId ?? null;
  const orderNumber = `SM-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
  const wallet = await ensureWalletForStudent(opts.studentId);

  return prisma.$transaction(async (tx) => {
    const current = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    if (current.balanceMinor < opts.subtotalMinor) {
      throw new AppError(400, "Insufficient wallet balance");
    }
    const balanceAfter = current.balanceMinor - opts.subtotalMinor;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: balanceAfter },
    });

    const created = await tx.order.create({
      data: {
        orderNumber,
        parentUserId: opts.parentUserId,
        studentId: opts.studentId,
        schoolId: opts.schoolId,
        vendorId,
        status: OrderStatus.PAID,
        subtotalMinor: opts.subtotalMinor,
        totalMinor: opts.subtotalMinor,
        notes: opts.notes,
        items: {
          create: opts.lines.map((l) => ({
            productId: l.productId,
            productName: l.name,
            quantity: l.quantity,
            unitPriceMinor: l.priceMinor,
            totalMinor: l.priceMinor * l.quantity,
          })),
        },
        statusHistory: {
          create: {
            toStatus: OrderStatus.PAID,
            actorUserId: opts.parentUserId,
            note: "Paid with student wallet",
          },
        },
        payments: {
          create: {
            parentUserId: opts.parentUserId,
            amountMinor: opts.subtotalMinor,
            method: PaymentMethod.WALLET,
            status: PaymentStatus.SUCCEEDED,
            providerRef: opts.paymentRef,
            idempotencyKey: opts.paymentRef,
            metadata: { source: "wallet_checkout" },
          },
        },
      },
      include: { items: true },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEBIT_SPEND",
        amountMinor: opts.subtotalMinor,
        balanceAfterMinor: balanceAfter,
        description: `Order ${created.orderNumber}`,
        referenceId: created.id,
      },
    });

    for (const l of opts.lines) {
      await tx.inventory.update({
        where: { productId: l.productId },
        data: { availableQty: { decrement: l.quantity } },
      });
    }

    return created;
  });
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
  const category = dominantCategory(lines);
  const evalResult = await evaluateWalletSpend(input.studentId, subtotalMinor, category);

  if (!evalResult.ok) {
    throw new AppError(400, evalResult.reason);
  }

  if (evalResult.requiresApproval) {
    const snapshot = {
      schoolId: input.schoolId,
      studentId: input.studentId,
      notes: input.notes,
      lines,
      subtotalMinor,
    };
    const spend = await prisma.walletSpendRequest.create({
      data: {
        studentId: input.studentId,
        parentUserId,
        amountMinor: subtotalMinor,
        category,
        status: WalletSpendStatus.PENDING,
        cartSnapshot: snapshot,
        notes: input.notes,
      },
    });

    await writeAuditLog({
      action: "WALLET_SPEND_PENDING",
      resourceType: "WalletSpendRequest",
      resourceId: spend.id,
      metadata: { amountMinor: subtotalMinor, studentId: input.studentId },
      context: { ...ctx, actorUserId: parentUserId },
    });

    return {
      status: "PENDING_APPROVAL" as const,
      spendRequestId: spend.id,
      amountMinor: subtotalMinor,
      message: "A spending rule requires your approval before this checkout completes.",
    };
  }

  const paymentRef = `wallet-${randomUUID()}`;
  const order = await createPaidOrderFromLines({
    parentUserId,
    studentId: input.studentId,
    schoolId: input.schoolId,
    lines,
    subtotalMinor,
    notes: input.notes,
    paymentRef,
  });

  await clearCart(parentUserId);

  await writeAuditLog({
    action: "CART_CHECKED_OUT_WALLET",
    resourceType: "Order",
    resourceId: order.id,
    metadata: { totalMinor: subtotalMinor },
    context: { ...ctx, actorUserId: parentUserId },
  });

  return {
    status: "PAID" as const,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      totalMinor: order.totalMinor,
      status: order.status,
    },
  };
}

export async function listPendingSpendRequests(parentUserId: string) {
  return prisma.walletSpendRequest.findMany({
    where: { parentUserId, status: WalletSpendStatus.PENDING },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, studentNumber: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewWalletSpend(
  parentUserId: string,
  input: ApproveWalletSpendInput,
  ctx: AuditContext,
) {
  const spend = await prisma.walletSpendRequest.findFirst({
    where: { id: input.spendRequestId, parentUserId },
  });
  if (!spend) throw new NotFoundError("Spend request not found");
  if (spend.status !== WalletSpendStatus.PENDING) {
    throw new AppError(400, "Spend request is not pending");
  }

  if (input.action === "REJECT") {
    const updated = await prisma.walletSpendRequest.update({
      where: { id: spend.id },
      data: { status: WalletSpendStatus.REJECTED },
    });
    await writeAuditLog({
      action: "WALLET_SPEND_REJECTED",
      resourceType: "WalletSpendRequest",
      resourceId: spend.id,
      context: { ...ctx, actorUserId: parentUserId },
    });
    return updated;
  }

  const snapshot = spend.cartSnapshot as {
    schoolId: string;
    studentId: string;
    notes?: string;
    lines: CartLine[];
    subtotalMinor: number;
  };

  const recheck = await evaluateWalletSpend(
    snapshot.studentId,
    snapshot.subtotalMinor,
    spend.category,
  );
  if (!recheck.ok) throw new AppError(400, recheck.reason);

  // Approval bypasses requiresApproval flag for this request
  const paymentRef = `wallet-approve-${randomUUID()}`;
  const order = await createPaidOrderFromLines({
    parentUserId,
    studentId: snapshot.studentId,
    schoolId: snapshot.schoolId,
    lines: snapshot.lines,
    subtotalMinor: snapshot.subtotalMinor,
    notes: snapshot.notes,
    paymentRef,
  });

  await prisma.walletSpendRequest.update({
    where: { id: spend.id },
    data: { status: WalletSpendStatus.COMPLETED, orderId: order.id },
  });

  await clearCart(parentUserId);

  await writeAuditLog({
    action: "WALLET_SPEND_APPROVED",
    resourceType: "WalletSpendRequest",
    resourceId: spend.id,
    metadata: { orderId: order.id },
    context: { ...ctx, actorUserId: parentUserId },
  });

  return {
    status: "COMPLETED",
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      totalMinor: order.totalMinor,
    },
  };
}

// Re-export getCart for type convenience in routes if needed
export { getCart };
