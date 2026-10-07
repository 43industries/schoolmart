import { prisma, LedgerAccountCode, VendorPayoutStatus } from "@schoolmart/db";
import type { SettleVendorPayoutInput, UpdateVendorPayoutDestinationInput } from "@schoolmart/shared";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

function asOrderIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

export async function updateVendorPayoutDestination(
  vendorId: string,
  input: UpdateVendorPayoutDestinationInput,
  ctx: AuditContext,
) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new NotFoundError("Vendor not found");

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      payoutMpesaPhone: input.payoutMpesaPhone === undefined ? undefined : input.payoutMpesaPhone || null,
      payoutBankName: input.payoutBankName === undefined ? undefined : input.payoutBankName || null,
      payoutAccountName: input.payoutAccountName === undefined ? undefined : input.payoutAccountName || null,
      payoutAccountNumber:
        input.payoutAccountNumber === undefined ? undefined : input.payoutAccountNumber || null,
    },
  });

  await writeAuditLog({
    action: "VENDOR_PAYOUT_DESTINATION_UPDATED",
    resourceType: "Vendor",
    resourceId: vendorId,
    context: ctx,
  });

  return {
    id: updated.id,
    payoutMpesaPhone: updated.payoutMpesaPhone,
    payoutBankName: updated.payoutBankName,
    payoutAccountName: updated.payoutAccountName,
    payoutAccountNumber: updated.payoutAccountNumber,
  };
}

export async function getVendorPayoutDestination(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      payoutMpesaPhone: true,
      payoutBankName: true,
      payoutAccountName: true,
      payoutAccountNumber: true,
    },
  });
  if (!vendor) throw new NotFoundError("Vendor not found");
  return vendor;
}

async function settledOrderIdSet(): Promise<Set<string>> {
  const payouts = await prisma.vendorPayout.findMany({
    where: { status: VendorPayoutStatus.PAID },
    select: { orderIds: true },
  });
  const set = new Set<string>();
  for (const p of payouts) {
    for (const id of asOrderIdList(p.orderIds)) set.add(id);
  }
  return set;
}

/** Payable reversed by refunds, per order. */
async function refundReversalsByOrder(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, number>();
  const rows = await prisma.ledgerEntry.groupBy({
    by: ["referenceId"],
    where: {
      accountCode: LedgerAccountCode.VENDOR_PAYABLE,
      referenceType: "OrderRefund",
      referenceId: { in: orderIds },
    },
    _sum: { debitMinor: true },
  });
  return new Map(rows.map((r) => [r.referenceId, r._sum.debitMinor ?? 0]));
}

export async function listOpenVendorPayables() {
  const credits = await prisma.ledgerEntry.findMany({
    where: {
      accountCode: LedgerAccountCode.VENDOR_PAYABLE,
      creditMinor: { gt: 0 },
      referenceType: "Order",
    },
    orderBy: { createdAt: "asc" },
  });
  const settled = await settledOrderIdSet();
  const unsettled = credits.filter((c) => !settled.has(c.referenceId));
  const reversals = await refundReversalsByOrder(unsettled.map((c) => c.referenceId));
  const openCredits = unsettled
    .map((c) => ({ ...c, creditMinor: c.creditMinor - (reversals.get(c.referenceId) ?? 0) }))
    .filter((c) => c.creditMinor > 0);
  if (openCredits.length === 0) return { payables: [], totalOpenMinor: 0 };

  const orderIds = openCredits.map((c) => c.referenceId);
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          payoutMpesaPhone: true,
          payoutBankName: true,
          payoutAccountName: true,
          payoutAccountNumber: true,
        },
      },
    },
  });
  const byId = new Map(orders.map((o) => [o.id, o]));

  const payables = openCredits.map((c) => {
    const order = byId.get(c.referenceId);
    return {
      ledgerEntryId: c.id,
      orderId: c.referenceId,
      orderNumber: order?.orderNumber ?? null,
      amountMinor: c.creditMinor,
      currency: c.currency,
      createdAt: c.createdAt,
      vendor: order?.vendor
        ? {
            id: order.vendor.id,
            name: order.vendor.name,
            payoutMpesaPhone: order.vendor.payoutMpesaPhone,
            payoutBankName: order.vendor.payoutBankName,
            payoutAccountName: order.vendor.payoutAccountName,
            payoutAccountNumber: order.vendor.payoutAccountNumber,
          }
        : null,
    };
  });

  return {
    payables,
    totalOpenMinor: payables.reduce((s, p) => s + p.amountMinor, 0),
  };
}

export async function listVendorPayouts(limit = 50) {
  return prisma.vendorPayout.findMany({
    take: Math.min(100, Math.max(1, limit)),
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { id: true, name: true } },
    },
  });
}

export async function settleVendorPayout(
  input: SettleVendorPayoutInput,
  actorUserId: string,
  ctx: AuditContext,
) {
  if (input.orderIds.length === 0) throw new ValidationError("Select at least one order to settle");

  const uniqueOrderIds = [...new Set(input.orderIds)];
  const settled = await settledOrderIdSet();
  for (const id of uniqueOrderIds) {
    if (settled.has(id)) throw new ValidationError(`Order ${id} is already settled`);
  }

  const credits = await prisma.ledgerEntry.findMany({
    where: {
      accountCode: LedgerAccountCode.VENDOR_PAYABLE,
      referenceType: "Order",
      referenceId: { in: uniqueOrderIds },
      creditMinor: { gt: 0 },
    },
  });
  if (credits.length !== uniqueOrderIds.length) {
    throw new ValidationError("One or more orders have no open vendor payable");
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: uniqueOrderIds } },
    select: { id: true, vendorId: true, orderNumber: true, totalMinor: true },
  });
  if (orders.length !== uniqueOrderIds.length) throw new NotFoundError("Order not found");

  for (const o of orders) {
    if (o.vendorId !== input.vendorId) {
      throw new ValidationError("All orders in a payout must belong to the same vendor");
    }
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
  if (!vendor) throw new NotFoundError("Vendor not found");
  if (!vendor.payoutMpesaPhone && !vendor.payoutAccountNumber) {
    throw new AppError(400, "Vendor has no payout destination on file");
  }

  const reversals = await refundReversalsByOrder(uniqueOrderIds);
  const netCredits = credits.map((c) => ({
    ...c,
    creditMinor: c.creditMinor - (reversals.get(c.referenceId) ?? 0),
  }));
  const fullyRefunded = netCredits.find((c) => c.creditMinor <= 0);
  if (fullyRefunded) {
    throw new ValidationError(`Order ${fullyRefunded.referenceId} was refunded and has nothing to settle`);
  }
  const amountMinor = netCredits.reduce((s, c) => s + c.creditMinor, 0);

  const payout = await prisma.$transaction(async (tx) => {
    const created = await tx.vendorPayout.create({
      data: {
        vendorId: input.vendorId,
        amountMinor,
        status: VendorPayoutStatus.PAID,
        orderIds: uniqueOrderIds,
        providerRef: input.providerRef ?? null,
        notes: input.notes ?? null,
        settledAt: new Date(),
        settledByUserId: actorUserId,
      },
    });

    for (const c of netCredits) {
      await tx.ledgerEntry.create({
        data: {
          accountCode: LedgerAccountCode.VENDOR_PAYABLE,
          debitMinor: c.creditMinor,
          creditMinor: 0,
          referenceType: "VendorPayout",
          referenceId: created.id,
          description: `Settled payable for order ${c.referenceId}`,
        },
      });
    }

    return created;
  });

  await writeAuditLog({
    action: "VENDOR_PAYOUT_SETTLED",
    resourceType: "VendorPayout",
    resourceId: payout.id,
    metadata: {
      vendorId: input.vendorId,
      amountMinor,
      orderIds: uniqueOrderIds,
      providerRef: input.providerRef ?? null,
    },
    context: { ...ctx, actorUserId },
  });

  return payout;
}

export async function assertVendorOwner(userId: string, vendorId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new NotFoundError("Vendor not found");
  if (vendor.ownerUserId && vendor.ownerUserId !== userId) {
    throw new ForbiddenError("Not your vendor");
  }
  return vendor;
}
