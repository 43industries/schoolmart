import { prisma, WalletSpendStatus } from "@schoolmart/db";
import type { ApproveWalletSpendInput } from "@schoolmart/shared";
import { randomUUID } from "node:crypto";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { clearCart } from "../cart/cart.service.js";
import {
  createPaidOrderFromLines,
  type CartLine,
} from "../cart/order-payment.service.js";
import { ensureWalletForStudent } from "./wallets.service.js";

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

/** Shared eval → pending spend request OR paid wallet order. */
export async function executeWalletCheckout(opts: {
  parentUserId: string;
  studentId: string;
  schoolId: string;
  lines: CartLine[];
  subtotalMinor: number;
  category: string;
  notes?: string;
  actorUserId: string;
  paymentRefPrefix: string;
  pendingAuditAction: string;
  paidAuditAction: string;
  pendingMessage: string;
  clearCartOnPay?: boolean;
  bypassApproval?: boolean;
  cartSnapshotExtra?: Record<string, unknown>;
  auditMetadata?: Record<string, unknown>;
  ctx: AuditContext;
}) {
  const evalResult = await evaluateWalletSpend(opts.studentId, opts.subtotalMinor, opts.category);
  if (!evalResult.ok) {
    throw new AppError(400, evalResult.reason);
  }

  if (evalResult.requiresApproval && !opts.bypassApproval) {
    const snapshot = {
      schoolId: opts.schoolId,
      studentId: opts.studentId,
      notes: opts.notes,
      lines: opts.lines,
      subtotalMinor: opts.subtotalMinor,
      ...opts.cartSnapshotExtra,
    };
    const spend = await prisma.walletSpendRequest.create({
      data: {
        studentId: opts.studentId,
        parentUserId: opts.parentUserId,
        amountMinor: opts.subtotalMinor,
        category: opts.category,
        status: WalletSpendStatus.PENDING,
        cartSnapshot: snapshot,
        notes: opts.notes,
      },
    });

    await writeAuditLog({
      action: opts.pendingAuditAction,
      resourceType: "WalletSpendRequest",
      resourceId: spend.id,
      metadata: {
        amountMinor: opts.subtotalMinor,
        studentId: opts.studentId,
        ...opts.auditMetadata,
      },
      context: { ...opts.ctx, actorUserId: opts.actorUserId },
    });

    return {
      status: "PENDING_APPROVAL" as const,
      spendRequestId: spend.id,
      amountMinor: opts.subtotalMinor,
      message: opts.pendingMessage,
    };
  }

  const paymentRef = `${opts.paymentRefPrefix}-${randomUUID()}`;
  const order = await createPaidOrderFromLines({
    parentUserId: opts.parentUserId,
    studentId: opts.studentId,
    schoolId: opts.schoolId,
    lines: opts.lines,
    subtotalMinor: opts.subtotalMinor,
    notes: opts.notes,
    paymentRef,
    actorUserId: opts.actorUserId,
  });

  if (opts.clearCartOnPay) {
    await clearCart(opts.parentUserId);
  }

  await writeAuditLog({
    action: opts.paidAuditAction,
    resourceType: "Order",
    resourceId: order.id,
    metadata: { totalMinor: opts.subtotalMinor, ...opts.auditMetadata },
    context: { ...opts.ctx, actorUserId: opts.actorUserId },
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
    return {
      id: updated.id,
      status: updated.status,
    };
  }

  const snapshot = spend.cartSnapshot as {
    schoolId: string;
    studentId: string;
    notes?: string;
    lines: CartLine[];
    subtotalMinor: number;
  };

  const result = await executeWalletCheckout({
    parentUserId,
    studentId: snapshot.studentId,
    schoolId: snapshot.schoolId,
    lines: snapshot.lines,
    subtotalMinor: snapshot.subtotalMinor,
    category: spend.category,
    notes: snapshot.notes,
    actorUserId: parentUserId,
    paymentRefPrefix: "wallet-approve",
    pendingAuditAction: "WALLET_SPEND_PENDING",
    paidAuditAction: "WALLET_SPEND_APPROVED",
    pendingMessage: "",
    clearCartOnPay: true,
    bypassApproval: true,
    auditMetadata: { spendRequestId: spend.id },
    ctx,
  });

  if (result.status !== "PAID") {
    throw new AppError(400, "Approved spend could not complete payment");
  }

  await prisma.walletSpendRequest.update({
    where: { id: spend.id },
    data: { status: WalletSpendStatus.COMPLETED, orderId: result.order.id },
  });

  return {
    status: "COMPLETED" as const,
    order: {
      id: result.order.id,
      orderNumber: result.order.orderNumber,
      totalMinor: result.order.totalMinor,
    },
  };
}
