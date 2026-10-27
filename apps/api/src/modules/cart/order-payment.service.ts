import {
  prisma,
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  type Prisma,
} from "@schoolmart/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { ensureWalletForStudent } from "../wallets/wallets.service.js";
import { postVendorPayableForOrder } from "../payments/vendor-payable.service.js";
import { notifyUser } from "../notifications/notifications.service.js";
import {
  consumeInventoryReservation,
  decrementAvailableStock,
  loadOrderInventoryLines,
  releaseInventoryReservation,
  reserveInventoryForLines,
} from "./inventory-reservation.service.js";
import { randomUUID } from "node:crypto";

export type CartLine = {
  productId: string;
  quantity: number;
  name: string;
  priceMinor: number;
  vendorId: string;
  categorySlug: string | null;
};

export type VendorGroup = {
  vendorId: string;
  lines: CartLine[];
  subtotalMinor: number;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  totalMinor: number;
  status: OrderStatus;
  vendorId: string | null;
};

export function mapCategory(slug: string | null): string {
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

export function dominantCategory(lines: CartLine[]): string {
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

/** Stable vendor grouping for multi-vendor checkout. */
export function groupLinesByVendor(lines: CartLine[]): VendorGroup[] {
  const map = new Map<string, CartLine[]>();
  for (const line of lines) {
    const list = map.get(line.vendorId) ?? [];
    list.push(line);
    map.set(line.vendorId, list);
  }
  return [...map.entries()].map(([vendorId, vendorLines]) => ({
    vendorId,
    lines: vendorLines,
    subtotalMinor: vendorLines.reduce((s, l) => s + l.priceMinor * l.quantity, 0),
  }));
}

function summarizeOrder(o: {
  id: string;
  orderNumber: string;
  totalMinor: number;
  status: OrderStatus;
  vendorId: string | null;
}): OrderSummary {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    totalMinor: o.totalMinor,
    status: o.status,
    vendorId: o.vendorId,
  };
}

function nextOrderNumber() {
  return `SM-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

/** Single-vendor wallet checkout (student buy-now and legacy callers). */
export async function createPaidOrderFromLines(opts: {
  parentUserId: string;
  studentId: string;
  schoolId: string;
  lines: CartLine[];
  subtotalMinor: number;
  notes?: string;
  paymentRef: string;
  actorUserId?: string;
}) {
  const groups = groupLinesByVendor(opts.lines);
  const result = await createPaidOrdersFromVendorGroups({
    parentUserId: opts.parentUserId,
    studentId: opts.studentId,
    schoolId: opts.schoolId,
    groups,
    notes: opts.notes,
    paymentRef: opts.paymentRef,
    actorUserId: opts.actorUserId,
  });
  return result.orders[0]!;
}

/**
 * One wallet debit for the cart total; one PAID order per vendor group.
 */
export async function createPaidOrdersFromVendorGroups(opts: {
  parentUserId: string;
  studentId: string;
  schoolId: string;
  groups: VendorGroup[];
  notes?: string;
  paymentRef: string;
  actorUserId?: string;
}) {
  if (opts.groups.length === 0) throw new AppError(400, "Cart is empty");

  const totalMinor = opts.groups.reduce((s, g) => s + g.subtotalMinor, 0);
  const wallet = await ensureWalletForStudent(opts.studentId);
  const actorUserId = opts.actorUserId ?? opts.parentUserId;
  const checkoutGroupId = opts.groups.length > 1 ? randomUUID() : null;

  const created = await prisma.$transaction(async (tx) => {
    const current = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    if (current.balanceMinor < totalMinor) {
      throw new AppError(400, "Insufficient wallet balance");
    }
    const balanceAfter = current.balanceMinor - totalMinor;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: balanceAfter },
    });

    const orders: Array<{
      id: string;
      orderNumber: string;
      totalMinor: number;
      status: OrderStatus;
      vendorId: string | null;
      items: unknown[];
    }> = [];

    for (const group of opts.groups) {
      const orderNumber = nextOrderNumber();
      const order = await tx.order.create({
        data: {
          orderNumber,
          parentUserId: opts.parentUserId,
          studentId: opts.studentId,
          schoolId: opts.schoolId,
          vendorId: group.vendorId,
          checkoutGroupId,
          status: OrderStatus.PAID,
          subtotalMinor: group.subtotalMinor,
          totalMinor: group.subtotalMinor,
          notes: opts.notes,
          items: {
            create: group.lines.map((l) => ({
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
              actorUserId,
              note:
                opts.groups.length > 1
                  ? "Paid with student wallet (multi-vendor checkout)"
                  : "Paid with student wallet",
            },
          },
        },
        include: { items: true },
      });

      await decrementAvailableStock(
        tx,
        group.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, name: l.name })),
      );

      await postVendorPayableForOrder(tx, {
        id: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        totalMinor: order.totalMinor,
      });

      orders.push(order);
    }

    const primary = orders[0]!;
    const orderIds = orders.map((o) => o.id);

    await tx.payment.create({
      data: {
        orderId: primary.id,
        parentUserId: opts.parentUserId,
        studentId: opts.studentId,
        actorUserId,
        purpose: PaymentPurpose.ORDER_CHECKOUT,
        amountMinor: totalMinor,
        method: PaymentMethod.WALLET,
        status: PaymentStatus.SUCCEEDED,
        provider: "wallet",
        providerRef: opts.paymentRef,
        idempotencyKey: opts.paymentRef,
        metadata: {
          source: "wallet_checkout",
          checkoutGroupId,
          orderIds,
        },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEBIT_SPEND",
        amountMinor: totalMinor,
        balanceAfterMinor: balanceAfter,
        description:
          orders.length === 1
            ? `Order ${primary.orderNumber}`
            : `Checkout ${orders.map((o) => o.orderNumber).join(", ")}`,
        referenceId: checkoutGroupId ?? primary.id,
      },
    });

    await notifyUser(
      {
        userId: opts.parentUserId,
        title: orders.length === 1 ? "Order paid" : "Orders paid",
        body:
          orders.length === 1
            ? `Order ${primary.orderNumber} was paid from the wallet and sent to the vendor.`
            : `${orders.length} orders (${orders.map((o) => o.orderNumber).join(", ")}) were paid from the wallet and sent to vendors.`,
        metadata: { orderId: primary.id, orderIds, checkoutGroupId },
      },
      tx,
    );

    return { orders, totalMinor, checkoutGroupId };
  });

  return {
    orders: created.orders.map(summarizeOrder),
    primary: summarizeOrder(created.orders[0]!),
    totalMinor: created.totalMinor,
    checkoutGroupId: created.checkoutGroupId,
  };
}

/** Single-vendor pending order (backward-compatible wrapper). */
export async function createPendingOrderFromLines(opts: {
  parentUserId: string;
  studentId: string;
  schoolId: string;
  lines: CartLine[];
  subtotalMinor: number;
  notes?: string;
  payment: {
    method: PaymentMethod;
    provider: string;
    providerRef: string;
    phoneE164?: string;
    instructions?: string;
  };
}) {
  const groups = groupLinesByVendor(opts.lines);
  const result = await createPendingOrdersFromVendorGroups({
    parentUserId: opts.parentUserId,
    studentId: opts.studentId,
    schoolId: opts.schoolId,
    groups,
    notes: opts.notes,
    payment: opts.payment,
  });
  return {
    ...result.primary,
    payments: result.payment ? [result.payment] : [],
  };
}

/**
 * Reserve stock for all lines; create one PENDING order per vendor; one Payment for the total.
 */
export async function createPendingOrdersFromVendorGroups(opts: {
  parentUserId: string;
  studentId: string;
  schoolId: string;
  groups: VendorGroup[];
  notes?: string;
  payment: {
    method: PaymentMethod;
    provider: string;
    providerRef: string;
    phoneE164?: string;
    instructions?: string;
  };
}) {
  if (opts.groups.length === 0) throw new AppError(400, "Cart is empty");

  const totalMinor = opts.groups.reduce((s, g) => s + g.subtotalMinor, 0);
  const checkoutGroupId = opts.groups.length > 1 ? randomUUID() : null;
  const idempotencyKey = `order-${opts.payment.providerRef}`;
  const allLines = opts.groups.flatMap((g) => g.lines);

  const result = await prisma.$transaction(async (tx) => {
    await reserveInventoryForLines(
      tx,
      allLines.map((l) => ({ productId: l.productId, quantity: l.quantity, name: l.name })),
    );

    const orders: Array<{
      id: string;
      orderNumber: string;
      totalMinor: number;
      status: OrderStatus;
      vendorId: string | null;
    }> = [];

    for (const group of opts.groups) {
      const order = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber(),
          parentUserId: opts.parentUserId,
          studentId: opts.studentId,
          schoolId: opts.schoolId,
          vendorId: group.vendorId,
          checkoutGroupId,
          status: OrderStatus.PENDING_PAYMENT,
          subtotalMinor: group.subtotalMinor,
          totalMinor: group.subtotalMinor,
          notes: opts.notes,
          items: {
            create: group.lines.map((l) => ({
              productId: l.productId,
              productName: l.name,
              quantity: l.quantity,
              unitPriceMinor: l.priceMinor,
              totalMinor: l.priceMinor * l.quantity,
            })),
          },
          statusHistory: {
            create: {
              toStatus: OrderStatus.PENDING_PAYMENT,
              actorUserId: opts.parentUserId,
              note:
                opts.groups.length > 1
                  ? `Awaiting ${opts.payment.method} payment (multi-vendor checkout)`
                  : `Awaiting ${opts.payment.method} payment`,
            },
          },
        },
      });
      orders.push(order);
    }

    const primary = orders[0]!;
    const orderIds = orders.map((o) => o.id);

    const payment = await tx.payment.create({
      data: {
        orderId: primary.id,
        parentUserId: opts.parentUserId,
        studentId: opts.studentId,
        actorUserId: opts.parentUserId,
        purpose: PaymentPurpose.ORDER_CHECKOUT,
        amountMinor: totalMinor,
        method: opts.payment.method,
        status: PaymentStatus.PROCESSING,
        provider: opts.payment.provider,
        providerRef: opts.payment.providerRef,
        idempotencyKey,
        phoneE164: opts.payment.phoneE164 ?? null,
        metadata: {
          instructions: opts.payment.instructions ?? null,
          stockReserved: true,
          checkoutGroupId,
          orderIds,
        } as Prisma.InputJsonValue,
      },
    });

    return { orders, payment, totalMinor, checkoutGroupId };
  });

  return {
    orders: result.orders.map(summarizeOrder),
    primary: summarizeOrder(result.orders[0]!),
    payment: result.payment,
    totalMinor: result.totalMinor,
    checkoutGroupId: result.checkoutGroupId,
  };
}

export async function finalizeDirectOrderPayment(orderId: string, actorUserId?: string | null) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new NotFoundError("Order not found");

  if (order.status === OrderStatus.PAID) {
    return order;
  }
  if (order.status !== OrderStatus.PENDING_PAYMENT && order.status !== OrderStatus.PAYMENT_PROCESSING) {
    throw new AppError(400, `Order cannot be marked paid from status ${order.status}`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID },
      include: { items: true },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: OrderStatus.PAID,
        actorUserId: actorUserId ?? order.parentUserId,
        note: "Direct payment succeeded",
      },
    });
    await consumeInventoryReservation(
      tx,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        name: item.productName,
      })),
    );
    await postVendorPayableForOrder(tx, {
      id: updated.id,
      orderNumber: updated.orderNumber,
      vendorId: updated.vendorId,
      totalMinor: updated.totalMinor,
    });
    return updated;
  });
}

/** Finalize every pending sibling in a checkout group (or a single order). */
export async function finalizeCheckoutGroupOrders(
  orderIds: string[],
  actorUserId?: string | null,
): Promise<OrderSummary[]> {
  const results: OrderSummary[] = [];
  for (const id of orderIds) {
    const paid = await finalizeDirectOrderPayment(id, actorUserId);
    results.push(summarizeOrder(paid));
  }
  return results;
}

/** Cancel pending siblings and release inventory holds. */
export async function cancelPendingCheckoutOrders(opts: {
  orderIds: string[];
  actorUserId?: string | null;
  note: string;
}) {
  await prisma.$transaction(async (tx) => {
    for (const orderId of opts.orderIds) {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) continue;
      if (
        order.status !== OrderStatus.PENDING_PAYMENT &&
        order.status !== OrderStatus.PAYMENT_PROCESSING
      ) {
        continue;
      }
      const lines = await loadOrderInventoryLines(tx, orderId);
      await releaseInventoryReservation(tx, lines);
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          actorUserId: opts.actorUserId,
          note: opts.note,
        },
      });
    }
  });
}

export function orderIdsFromPaymentMetadata(
  metadata: unknown,
  fallbackOrderId: string | null,
): string[] {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const ids = (metadata as { orderIds?: unknown }).orderIds;
    if (Array.isArray(ids) && ids.every((x) => typeof x === "string")) {
      return ids as string[];
    }
  }
  return fallbackOrderId ? [fallbackOrderId] : [];
}
