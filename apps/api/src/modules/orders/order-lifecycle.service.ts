import {
  prisma,
  LedgerAccountCode,
  OrderStatus,
  PaymentStatus,
  type Prisma,
} from "@schoolmart/db";
import { formatKES } from "@schoolmart/shared";
import { AppError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { notifyUser } from "../notifications/notifications.service.js";
import { creditStudentWallet } from "../wallets/wallet-credit.service.js";

const STATUS_COPY: Partial<Record<OrderStatus, string>> = {
  VENDOR_ACCEPTED: "was accepted by the vendor",
  PREPARING: "is being prepared",
  READY_FOR_DISPATCH: "is packed and waiting for a delivery agent",
  DISPATCHED: "was assigned to a delivery agent",
  IN_TRANSIT: "is on the way to school",
  RECEIVED_BY_SCHOOL: "arrived at school",
  READY_FOR_COLLECTION: "is ready for your child to collect",
  COLLECTED: "was collected by your child",
  CANCELLED: "was cancelled",
  REFUNDED: "was refunded",
  DELIVERY_FAILED: "could not be delivered — our team will follow up",
};

/** Orders whose money has been captured (wallet debited or direct payment succeeded). */
export const PAID_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.GROUPED,
  OrderStatus.VENDOR_ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DISPATCH,
  OrderStatus.DISPATCHED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.RECEIVED_BY_SCHOOL,
  OrderStatus.READY_FOR_COLLECTION,
  OrderStatus.DELIVERY_FAILED,
  OrderStatus.REFUND_PENDING,
];

/**
 * Move orders from one of `from` to `to`, writing history and notifying parents.
 * Orders not currently in an allowed status are skipped; returns the ids that moved.
 */
export async function transitionOrders(params: {
  orderIds: string[];
  from: OrderStatus[];
  to: OrderStatus;
  actorUserId?: string | null;
  note?: string;
  where?: Prisma.OrderWhereInput;
  data?: Prisma.OrderUncheckedUpdateManyInput;
  tx?: Prisma.TransactionClient;
}) {
  const run = async (tx: Prisma.TransactionClient) => {
    const orders = await tx.order.findMany({
      where: { id: { in: params.orderIds }, status: { in: params.from }, ...(params.where ?? {}) },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        parentUserId: true,
        student: { select: { userId: true, firstName: true } },
      },
    });
    const moved: typeof orders = [];
    for (const order of orders) {
      const res = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: params.to, ...(params.data ?? {}) },
      });
      if (res.count === 0) continue;
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: params.to,
          actorUserId: params.actorUserId ?? null,
          note: params.note,
        },
      });
      const copy = STATUS_COPY[params.to];
      if (copy) {
        await notifyUser(
          {
            userId: order.parentUserId,
            title: `Order ${order.orderNumber}`,
            body: `Order ${order.orderNumber} ${copy}.${params.note ? ` ${params.note}` : ""}`,
            metadata: { orderId: order.id, status: params.to },
          },
          tx,
        );
      }
      if (params.to === OrderStatus.READY_FOR_COLLECTION) {
        await notifyUser(
          {
            userId: order.student.userId,
            title: "Package ready to collect",
            body: `Order ${order.orderNumber} is at the school collection point. Bring your collection PIN.`,
            metadata: { orderId: order.id },
          },
          tx,
        );
      }
      moved.push(order);
    }
    return moved.map((o) => o.id);
  };
  return params.tx ? run(params.tx) : prisma.$transaction(run);
}

async function refundedSoFar(db: Prisma.TransactionClient | typeof prisma, orderId: string) {
  const agg = await db.ledgerEntry.aggregate({
    where: { accountCode: LedgerAccountCode.REFUND, referenceType: "Order", referenceId: orderId },
    _sum: { creditMinor: true },
  });
  return agg._sum.creditMinor ?? 0;
}

export async function getRefundedMinor(orderId: string) {
  return refundedSoFar(prisma, orderId);
}

/**
 * Refund a paid order to the child's wallet (full or partial). Reverses the vendor payable
 * by the same amount and, on a full refund, restores stock and closes the order.
 * Direct M-PESA/card payments are refunded as wallet credit until provider reversals are wired.
 */
export async function refundOrderToWallet(params: {
  orderId: string;
  amountMinor?: number;
  reason: string;
  actorUserId: string;
  ctx: AuditContext;
  allowedStatuses?: OrderStatus[];
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { items: true },
  });
  if (!order) throw new NotFoundError("Order not found");

  const allowed = params.allowedStatuses ?? PAID_ORDER_STATUSES;
  if (!allowed.includes(order.status)) {
    throw new AppError(400, `Order cannot be refunded from status ${order.status}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const already = await refundedSoFar(tx, order.id);
    const remaining = order.totalMinor - already;
    if (remaining <= 0) throw new AppError(400, "Order is already fully refunded");

    const amount = params.amountMinor ?? remaining;
    if (!Number.isInteger(amount) || amount <= 0) throw new ValidationError("Refund amount must be positive");
    if (amount > remaining) {
      throw new ValidationError(`Refund exceeds remaining refundable amount (${formatKES(remaining)})`);
    }
    const isFull = amount === remaining;
    const refundIndex = already > 0 ? `-${already}` : "";

    const credited = await creditStudentWallet(
      {
        studentId: order.studentId,
        amountMinor: amount,
        type: "CREDIT_REFUND",
        description: `Refund · ${order.orderNumber}${isFull ? "" : " (partial)"} · ${params.reason}`,
        referenceId: `refund-${order.id}${refundIndex}`,
      },
      tx,
    );

    await tx.ledgerEntry.create({
      data: {
        accountCode: LedgerAccountCode.REFUND,
        creditMinor: amount,
        referenceType: "Order",
        referenceId: order.id,
        description: `Refund to wallet · ${order.orderNumber} · ${params.reason}`,
      },
    });
    if (order.vendorId) {
      await tx.ledgerEntry.create({
        data: {
          accountCode: LedgerAccountCode.VENDOR_PAYABLE,
          debitMinor: amount,
          referenceType: "OrderRefund",
          referenceId: order.id,
          description: `Payable reversed for refund · ${order.orderNumber} · vendor ${order.vendorId}`,
        },
      });
    }

    if (isFull) {
      const stockStillHeld = order.status !== OrderStatus.COLLECTED && order.status !== OrderStatus.COMPLETED;
      if (stockStillHeld) {
        for (const item of order.items) {
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { availableQty: { increment: item.quantity } },
          });
        }
      }
      await tx.payment.updateMany({
        where: { orderId: order.id, status: PaymentStatus.SUCCEEDED },
        data: { status: PaymentStatus.REFUNDED },
      });
      await transitionOrders({
        orderIds: [order.id],
        from: [order.status],
        to: OrderStatus.REFUNDED,
        actorUserId: params.actorUserId,
        note: `${formatKES(amount)} refunded to wallet: ${params.reason}`,
        tx,
      });
    } else {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          actorUserId: params.actorUserId,
          note: `Partial refund ${formatKES(amount)} to wallet: ${params.reason}`,
        },
      });
      await notifyUser(
        {
          userId: order.parentUserId,
          title: `Partial refund · ${order.orderNumber}`,
          body: `${formatKES(amount)} was refunded to your child's wallet. ${params.reason}`,
          metadata: { orderId: order.id },
        },
        tx,
      );
    }

    return { amountMinor: amount, full: isFull, walletBalanceMinor: credited.balanceMinor };
  });

  await writeAuditLog({
    action: result.full ? "ORDER_REFUNDED" : "ORDER_PARTIALLY_REFUNDED",
    resourceType: "Order",
    resourceId: order.id,
    metadata: { amountMinor: result.amountMinor, reason: params.reason },
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });

  return result;
}

/** Parent cancels: unpaid orders are closed; paid orders not yet accepted are refunded to wallet. */
export async function cancelOrderByParent(parentUserId: string, orderId: string, ctx: AuditContext) {
  const order = await prisma.order.findFirst({ where: { id: orderId, parentUserId } });
  if (!order) throw new NotFoundError("Order not found");

  if (order.status === OrderStatus.PENDING_PAYMENT || order.status === OrderStatus.PAYMENT_PROCESSING) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { orderId, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
        data: { status: PaymentStatus.CANCELLED },
      });
      await transitionOrders({
        orderIds: [orderId],
        from: [order.status],
        to: OrderStatus.CANCELLED,
        actorUserId: parentUserId,
        note: "Cancelled by parent before payment",
        tx,
      });
    });
    await writeAuditLog({
      action: "ORDER_CANCELLED_BY_PARENT",
      resourceType: "Order",
      resourceId: orderId,
      context: { ...ctx, actorUserId: parentUserId },
    });
    return { status: OrderStatus.CANCELLED, refundedMinor: 0 };
  }

  if (order.status === OrderStatus.PAID) {
    const refund = await refundOrderToWallet({
      orderId,
      reason: "Cancelled by parent",
      actorUserId: parentUserId,
      ctx,
      allowedStatuses: [OrderStatus.PAID],
    });
    return { status: OrderStatus.REFUNDED, refundedMinor: refund.amountMinor };
  }

  throw new AppError(
    400,
    "This order is already with the vendor and can no longer be cancelled here. Contact support for help.",
  );
}

export async function getOrderTimeline(orderId: string) {
  return prisma.orderStatusHistory.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true },
  });
}
