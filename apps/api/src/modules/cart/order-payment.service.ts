import {
  prisma,
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from "@schoolmart/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { ensureWalletForStudent } from "../wallets/wallets.service.js";
import { randomUUID } from "node:crypto";

export type CartLine = {
  productId: string;
  quantity: number;
  name: string;
  priceMinor: number;
  vendorId: string;
  categorySlug: string | null;
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
  const vendorId = opts.lines[0]?.vendorId ?? null;
  const orderNumber = `SM-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
  const wallet = await ensureWalletForStudent(opts.studentId);
  const actorUserId = opts.actorUserId ?? opts.parentUserId;

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
            actorUserId,
            note: "Paid with student wallet",
          },
        },
        payments: {
          create: {
            parentUserId: opts.parentUserId,
            studentId: opts.studentId,
            actorUserId,
            purpose: PaymentPurpose.ORDER_CHECKOUT,
            amountMinor: opts.subtotalMinor,
            method: PaymentMethod.WALLET,
            status: PaymentStatus.SUCCEEDED,
            provider: "wallet",
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
  const vendorId = opts.lines[0]?.vendorId ?? null;
  const orderNumber = `SM-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
  const idempotencyKey = `order-${opts.payment.providerRef}`;

  return prisma.order.create({
    data: {
      orderNumber,
      parentUserId: opts.parentUserId,
      studentId: opts.studentId,
      schoolId: opts.schoolId,
      vendorId,
      status: OrderStatus.PENDING_PAYMENT,
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
          toStatus: OrderStatus.PENDING_PAYMENT,
          actorUserId: opts.parentUserId,
          note: `Awaiting ${opts.payment.method} payment`,
        },
      },
      payments: {
        create: {
          parentUserId: opts.parentUserId,
          studentId: opts.studentId,
          actorUserId: opts.parentUserId,
          purpose: PaymentPurpose.ORDER_CHECKOUT,
          amountMinor: opts.subtotalMinor,
          method: opts.payment.method,
          status: PaymentStatus.PROCESSING,
          provider: opts.payment.provider,
          providerRef: opts.payment.providerRef,
          idempotencyKey,
          phoneE164: opts.payment.phoneE164 ?? null,
          metadata: {
            instructions: opts.payment.instructions ?? null,
          },
        },
      },
    },
    include: { items: true, payments: true },
  });
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
    for (const item of order.items) {
      await tx.inventory.update({
        where: { productId: item.productId },
        data: { availableQty: { decrement: item.quantity } },
      });
    }
    return updated;
  });
}
