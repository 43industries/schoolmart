import { LedgerAccountCode, type Prisma } from "@schoolmart/db";

type Tx = Prisma.TransactionClient;

/** Credit VENDOR_PAYABLE when an order is paid (platform owes vendor). Idempotent per order. */
export async function postVendorPayableForOrder(
  tx: Tx,
  order: { id: string; orderNumber: string; vendorId: string | null; totalMinor: number },
) {
  if (!order.vendorId || order.totalMinor <= 0) return;

  const existing = await tx.ledgerEntry.findFirst({
    where: {
      accountCode: LedgerAccountCode.VENDOR_PAYABLE,
      referenceType: "Order",
      referenceId: order.id,
      creditMinor: { gt: 0 },
    },
  });
  if (existing) return;

  await tx.ledgerEntry.create({
    data: {
      accountCode: LedgerAccountCode.VENDOR_PAYABLE,
      creditMinor: order.totalMinor,
      debitMinor: 0,
      referenceType: "Order",
      referenceId: order.id,
      description: `Vendor payable · ${order.orderNumber} · vendor ${order.vendorId}`,
    },
  });
}
