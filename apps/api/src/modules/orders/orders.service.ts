import { randomUUID } from "node:crypto";
import {
  prisma,
  DeliveryBatchStatus,
  DeliveryPartnerStatus,
  LedgerAccountCode,
  OrderStatus,
  type Prisma,
} from "@schoolmart/db";
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { verifyPin } from "../../lib/crypto.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { refundOrderToWallet, transitionOrders } from "./order-lifecycle.service.js";

const orderListInclude = {
  items: { select: { id: true, productName: true, quantity: true, totalMinor: true } },
  vendor: { select: { id: true, name: true } },
  school: { select: { id: true, name: true, town: true } },
  student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, grade: true } },
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true },
  },
} satisfies Prisma.OrderInclude;

async function refundTotals(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, number>();
  const rows = await prisma.ledgerEntry.groupBy({
    by: ["referenceId"],
    where: { accountCode: LedgerAccountCode.REFUND, referenceType: "Order", referenceId: { in: orderIds } },
    _sum: { creditMinor: true },
  });
  return new Map(rows.map((r) => [r.referenceId, r._sum.creditMinor ?? 0]));
}

// ─── Parent ──────────────────────────────────────────────────────────────────

export async function listParentOrders(parentUserId: string) {
  const orders = await prisma.order.findMany({
    where: { parentUserId, status: { not: OrderStatus.DRAFT } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      ...orderListInclude,
      payments: { select: { id: true, method: true, status: true, provider: true } },
      deliveryBatch: { select: { batchNumber: true, status: true, pickedUpAt: true, deliveredAt: true } },
    },
  });
  const refunds = await refundTotals(orders.map((o) => o.id));
  return orders.map((o) => ({
    ...o,
    refundedMinor: refunds.get(o.id) ?? 0,
    canCancel:
      o.status === OrderStatus.PENDING_PAYMENT ||
      o.status === OrderStatus.PAYMENT_PROCESSING ||
      o.status === OrderStatus.PAID,
  }));
}

// ─── Vendor ──────────────────────────────────────────────────────────────────

const VENDOR_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  VENDOR_ACCEPTED: [OrderStatus.PAID, OrderStatus.GROUPED],
  PREPARING: [OrderStatus.VENDOR_ACCEPTED],
  READY_FOR_DISPATCH: [OrderStatus.PREPARING, OrderStatus.VENDOR_ACCEPTED],
};

export const VENDOR_SETTABLE_STATUSES = Object.keys(VENDOR_TRANSITIONS) as OrderStatus[];

export async function listVendorOrders(vendorId: string, view: "active" | "history") {
  const active: OrderStatus[] = [
    OrderStatus.PAID,
    OrderStatus.GROUPED,
    OrderStatus.VENDOR_ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_DISPATCH,
  ];
  return prisma.order.findMany({
    where: {
      vendorId,
      status: view === "active" ? { in: active } : { notIn: [...active, OrderStatus.DRAFT, OrderStatus.PENDING_PAYMENT] },
    },
    orderBy: { createdAt: view === "active" ? "asc" : "desc" },
    take: 100,
    include: {
      items: orderListInclude.items,
      school: orderListInclude.school,
      student: { select: { firstName: true, lastName: true, studentNumber: true, grade: true } },
    },
  });
}

export async function updateVendorOrderStatus(params: {
  vendorId: string;
  orderId: string;
  status: OrderStatus;
  actorUserId: string;
  ctx: AuditContext;
}) {
  const from = VENDOR_TRANSITIONS[params.status];
  if (!from) throw new ValidationError(`Vendors cannot set status ${params.status}`);
  const order = await prisma.order.findFirst({ where: { id: params.orderId, vendorId: params.vendorId } });
  if (!order) throw new NotFoundError("Order not found");

  const moved = await transitionOrders({
    orderIds: [order.id],
    from,
    to: params.status,
    actorUserId: params.actorUserId,
  });
  if (moved.length === 0) {
    throw new AppError(400, `Order is ${order.status} and cannot move to ${params.status}`);
  }
  await writeAuditLog({
    action: "VENDOR_ORDER_STATUS_UPDATED",
    resourceType: "Order",
    resourceId: order.id,
    metadata: { from: order.status, to: params.status },
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });
  return { id: order.id, status: params.status };
}

export async function rejectVendorOrder(params: {
  vendorId: string;
  orderId: string;
  reason: string;
  actorUserId: string;
  ctx: AuditContext;
}) {
  const order = await prisma.order.findFirst({ where: { id: params.orderId, vendorId: params.vendorId } });
  if (!order) throw new NotFoundError("Order not found");
  return refundOrderToWallet({
    orderId: order.id,
    reason: `Vendor could not fulfil: ${params.reason}`,
    actorUserId: params.actorUserId,
    ctx: params.ctx,
    allowedStatuses: [
      OrderStatus.PAID,
      OrderStatus.GROUPED,
      OrderStatus.VENDOR_ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_DISPATCH,
    ],
  });
}

// ─── School ──────────────────────────────────────────────────────────────────

/** Packages waiting at the collection point longer than this are flagged as uncollected. */
const UNCOLLECTED_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export async function listSchoolOrders(schoolId: string) {
  const orders = await prisma.order.findMany({
    where: {
      schoolId,
      status: {
        in: [
          OrderStatus.READY_FOR_DISPATCH,
          OrderStatus.DISPATCHED,
          OrderStatus.IN_TRANSIT,
          OrderStatus.RECEIVED_BY_SCHOOL,
          OrderStatus.READY_FOR_COLLECTION,
        ],
      },
    },
    orderBy: { updatedAt: "asc" },
    take: 300,
    include: {
      items: orderListInclude.items,
      vendor: orderListInclude.vendor,
      student: orderListInclude.student,
      deliveryBatch: {
        select: {
          batchNumber: true,
          status: true,
          deliveryPartner: { select: { owner: { select: { firstName: true, lastName: true, phoneE164: true } } } },
        },
      },
    },
  });

  const now = Date.now();
  const recentlyCollected = await prisma.order.findMany({
    where: { schoolId, status: OrderStatus.COLLECTED },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { student: orderListInclude.student, vendor: orderListInclude.vendor },
  });

  const incoming = orders.filter((o) =>
    ([OrderStatus.READY_FOR_DISPATCH, OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT] as OrderStatus[]).includes(o.status),
  );
  const received = orders.filter((o) => o.status === OrderStatus.RECEIVED_BY_SCHOOL);
  const ready = orders
    .filter((o) => o.status === OrderStatus.READY_FOR_COLLECTION)
    .map((o) => ({ ...o, uncollected: now - o.updatedAt.getTime() > UNCOLLECTED_AFTER_MS }));

  return { incoming, received, ready, recentlyCollected };
}

export async function receiveSchoolOrders(params: {
  schoolId: string;
  orderIds: string[];
  actorUserId: string;
  ctx: AuditContext;
}) {
  const moved = await transitionOrders({
    orderIds: params.orderIds,
    from: [OrderStatus.READY_FOR_DISPATCH, OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT],
    to: OrderStatus.RECEIVED_BY_SCHOOL,
    actorUserId: params.actorUserId,
    note: "Received at school collection point",
    where: { schoolId: params.schoolId },
  });
  await writeAuditLog({
    action: "SCHOOL_ORDERS_RECEIVED",
    resourceType: "School",
    resourceId: params.schoolId,
    metadata: { orderIds: moved },
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });
  return { moved };
}

export async function markSchoolOrdersReady(params: {
  schoolId: string;
  orderIds: string[];
  actorUserId: string;
  ctx: AuditContext;
}) {
  const moved = await transitionOrders({
    orderIds: params.orderIds,
    from: [OrderStatus.RECEIVED_BY_SCHOOL],
    to: OrderStatus.READY_FOR_COLLECTION,
    actorUserId: params.actorUserId,
    where: { schoolId: params.schoolId },
  });
  await writeAuditLog({
    action: "SCHOOL_ORDERS_READY",
    resourceType: "School",
    resourceId: params.schoolId,
    metadata: { orderIds: moved },
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });
  return { moved };
}

/** Desk handover: staff enters the student's collection PIN on the school device. */
export async function handoverAtDesk(params: {
  schoolId: string;
  orderId: string;
  collectionPin: string;
  actorUserId: string;
  ctx: AuditContext;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, schoolId: params.schoolId, status: OrderStatus.READY_FOR_COLLECTION },
    include: { student: { select: { id: true, collectionPinHash: true } } },
  });
  if (!order) throw new NotFoundError("Order is not ready for collection at this school");
  if (!order.student.collectionPinHash) throw new ForbiddenError("Student has no collection PIN set");

  const ok = await verifyPin(order.student.collectionPinHash, params.collectionPin);
  if (!ok) {
    await writeAuditLog({
      action: "COLLECTION_PIN_FAILED",
      resourceType: "Order",
      resourceId: order.id,
      metadata: { studentId: order.student.id, channel: "school_desk" },
      context: { ...params.ctx, actorUserId: params.actorUserId },
    });
    throw new UnauthorizedError("Invalid collection PIN");
  }

  await transitionOrders({
    orderIds: [order.id],
    from: [OrderStatus.READY_FOR_COLLECTION],
    to: OrderStatus.COLLECTED,
    actorUserId: params.actorUserId,
    note: "Handed over at school desk (PIN verified)",
  });
  await writeAuditLog({
    action: "ORDER_COLLECTED",
    resourceType: "Order",
    resourceId: order.id,
    metadata: { studentId: order.student.id, channel: "school_desk" },
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });
  return { id: order.id, status: OrderStatus.COLLECTED };
}

// ─── Driver ──────────────────────────────────────────────────────────────────

async function getApprovedPartner(partnerId: string) {
  const partner = await prisma.deliveryPartner.findUnique({
    where: { id: partnerId },
    include: { owner: { select: { firstName: true, lastName: true, phoneE164: true } } },
  });
  if (!partner) throw new NotFoundError("Delivery partner not found");
  return partner;
}

async function assertApproved(partnerId: string) {
  const partner = await getApprovedPartner(partnerId);
  if (partner.status !== DeliveryPartnerStatus.APPROVED) {
    throw new ForbiddenError("Your delivery partner account is awaiting approval");
  }
  return partner;
}

export async function getDriverProfile(partnerId: string) {
  return getApprovedPartner(partnerId);
}

/** Packed orders without a batch, grouped by school. */
export async function listDriverJobs(partnerId: string) {
  await assertApproved(partnerId);
  const orders = await prisma.order.findMany({
    where: { status: OrderStatus.READY_FOR_DISPATCH, deliveryBatchId: null },
    orderBy: { updatedAt: "asc" },
    take: 500,
    select: {
      id: true,
      orderNumber: true,
      totalMinor: true,
      schoolId: true,
      school: { select: { id: true, name: true, town: true, county: true } },
      vendor: { select: { id: true, name: true, town: true, addressLine: true, contactPhone: true } },
    },
  });

  const bySchool = new Map<
    string,
    {
      school: (typeof orders)[number]["school"];
      orderCount: number;
      vendors: Map<string, NonNullable<(typeof orders)[number]["vendor"]>>;
      oldestReadyAt?: Date;
    }
  >();
  for (const o of orders) {
    const entry = bySchool.get(o.schoolId) ?? { school: o.school, orderCount: 0, vendors: new Map() };
    entry.orderCount++;
    if (o.vendor) entry.vendors.set(o.vendor.id, o.vendor);
    bySchool.set(o.schoolId, entry);
  }
  return [...bySchool.values()].map((e) => ({
    school: e.school,
    orderCount: e.orderCount,
    pickups: [...e.vendors.values()],
  }));
}

export async function acceptDriverJob(params: {
  partnerId: string;
  schoolId: string;
  actorUserId: string;
  ctx: AuditContext;
}) {
  await assertApproved(params.partnerId);

  const batch = await prisma.$transaction(async (tx) => {
    const candidates = await tx.order.findMany({
      where: { schoolId: params.schoolId, status: OrderStatus.READY_FOR_DISPATCH, deliveryBatchId: null },
      select: { id: true, orderNumber: true, vendorId: true },
    });
    if (candidates.length === 0) throw new AppError(409, "No packed orders are waiting for this school");

    const created = await tx.deliveryBatch.create({
      data: {
        schoolId: params.schoolId,
        deliveryPartnerId: params.partnerId,
        batchNumber: `DB-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`,
        deliveryDate: new Date(),
        status: DeliveryBatchStatus.PLANNED,
        orderCount: 0,
        manifest: { orders: candidates.map((c) => c.orderNumber) },
      },
    });

    // Claim only orders still unassigned so two drivers cannot take the same parcel.
    const claimed = await tx.order.updateMany({
      where: { id: { in: candidates.map((c) => c.id) }, deliveryBatchId: null, status: OrderStatus.READY_FOR_DISPATCH },
      data: { deliveryBatchId: created.id },
    });
    if (claimed.count === 0) throw new AppError(409, "These orders were just taken by another agent");

    const claimedIds = (
      await tx.order.findMany({ where: { deliveryBatchId: created.id }, select: { id: true } })
    ).map((o) => o.id);

    await transitionOrders({
      orderIds: claimedIds,
      from: [OrderStatus.READY_FOR_DISPATCH],
      to: OrderStatus.DISPATCHED,
      actorUserId: params.actorUserId,
      tx,
    });

    return tx.deliveryBatch.update({
      where: { id: created.id },
      data: { orderCount: claimedIds.length },
    });
  });

  await writeAuditLog({
    action: "DELIVERY_JOB_ACCEPTED",
    resourceType: "DeliveryBatch",
    resourceId: batch.id,
    metadata: { schoolId: params.schoolId, orderCount: batch.orderCount },
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });
  return batch;
}

export async function listDriverBatches(partnerId: string) {
  return prisma.deliveryBatch.findMany({
    where: { deliveryPartnerId: partnerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      school: { select: { id: true, name: true, town: true, county: true, addressLine: true } },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          vendor: { select: { id: true, name: true, town: true, addressLine: true, contactPhone: true } },
          items: { select: { productName: true, quantity: true } },
        },
      },
    },
  });
}

async function getOwnBatch(partnerId: string, batchId: string) {
  const batch = await prisma.deliveryBatch.findFirst({
    where: { id: batchId, deliveryPartnerId: partnerId },
    include: { orders: { select: { id: true } } },
  });
  if (!batch) throw new NotFoundError("Delivery batch not found");
  return batch;
}

function manifestObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

export async function pickupBatch(params: { partnerId: string; batchId: string; actorUserId: string; ctx: AuditContext }) {
  await assertApproved(params.partnerId);
  const batch = await getOwnBatch(params.partnerId, params.batchId);
  if (batch.status !== DeliveryBatchStatus.PLANNED) throw new AppError(400, `Batch is already ${batch.status}`);

  await prisma.$transaction(async (tx) => {
    await tx.deliveryBatch.update({
      where: { id: batch.id },
      data: { status: DeliveryBatchStatus.IN_PROGRESS, pickedUpAt: new Date() },
    });
    await transitionOrders({
      orderIds: batch.orders.map((o) => o.id),
      from: [OrderStatus.DISPATCHED],
      to: OrderStatus.IN_TRANSIT,
      actorUserId: params.actorUserId,
      tx,
    });
  });
  await writeAuditLog({
    action: "DELIVERY_PICKED_UP",
    resourceType: "DeliveryBatch",
    resourceId: batch.id,
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });
  return { id: batch.id, status: DeliveryBatchStatus.IN_PROGRESS };
}

export async function deliverBatch(params: {
  partnerId: string;
  batchId: string;
  recipientName: string;
  notes?: string;
  actorUserId: string;
  ctx: AuditContext;
}) {
  await assertApproved(params.partnerId);
  const batch = await getOwnBatch(params.partnerId, params.batchId);
  if (batch.status !== DeliveryBatchStatus.IN_PROGRESS) {
    throw new AppError(400, "Confirm pickup before marking the batch delivered");
  }
  const deliveredAt = new Date();
  const manifest = manifestObject(batch.manifest);
  manifest.proofOfDelivery = {
    recipientName: params.recipientName,
    notes: params.notes ?? null,
    deliveredAt: deliveredAt.toISOString(),
  };

  await prisma.$transaction(async (tx) => {
    await tx.deliveryBatch.update({
      where: { id: batch.id },
      data: { status: DeliveryBatchStatus.DELIVERED, deliveredAt, manifest: manifest as Prisma.InputJsonValue },
    });
    await transitionOrders({
      orderIds: batch.orders.map((o) => o.id),
      from: [OrderStatus.IN_TRANSIT, OrderStatus.DISPATCHED],
      to: OrderStatus.RECEIVED_BY_SCHOOL,
      actorUserId: params.actorUserId,
      note: `Handed to ${params.recipientName} at school`,
      tx,
    });
  });
  await writeAuditLog({
    action: "DELIVERY_COMPLETED",
    resourceType: "DeliveryBatch",
    resourceId: batch.id,
    metadata: { recipientName: params.recipientName },
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });
  return { id: batch.id, status: DeliveryBatchStatus.DELIVERED };
}

export async function failBatch(params: {
  partnerId: string;
  batchId: string;
  reason: string;
  actorUserId: string;
  ctx: AuditContext;
}) {
  await assertApproved(params.partnerId);
  const batch = await getOwnBatch(params.partnerId, params.batchId);
  if (batch.status !== DeliveryBatchStatus.PLANNED && batch.status !== DeliveryBatchStatus.IN_PROGRESS) {
    throw new AppError(400, `Batch is already ${batch.status}`);
  }
  const manifest = manifestObject(batch.manifest);
  manifest.failure = { reason: params.reason, at: new Date().toISOString() };

  await prisma.$transaction(async (tx) => {
    await tx.deliveryBatch.update({
      where: { id: batch.id },
      data: { status: DeliveryBatchStatus.FAILED, manifest: manifest as Prisma.InputJsonValue },
    });
    if (batch.status === DeliveryBatchStatus.PLANNED) {
      // Not yet collected from the vendor: release orders back to the job board.
      await transitionOrders({
        orderIds: batch.orders.map((o) => o.id),
        from: [OrderStatus.DISPATCHED],
        to: OrderStatus.READY_FOR_DISPATCH,
        actorUserId: params.actorUserId,
        note: `Delivery agent released the job: ${params.reason}`,
        data: { deliveryBatchId: null },
        tx,
      });
    } else {
      await transitionOrders({
        orderIds: batch.orders.map((o) => o.id),
        from: [OrderStatus.IN_TRANSIT],
        to: OrderStatus.DELIVERY_FAILED,
        actorUserId: params.actorUserId,
        note: params.reason,
        tx,
      });
    }
  });
  await writeAuditLog({
    action: "DELIVERY_FAILED",
    resourceType: "DeliveryBatch",
    resourceId: batch.id,
    metadata: { reason: params.reason },
    context: { ...params.ctx, actorUserId: params.actorUserId },
  });
  return { id: batch.id, status: DeliveryBatchStatus.FAILED };
}
