import { prisma, Prisma } from "@schoolmart/db";
import { AppError } from "../../lib/errors.js";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type InventoryLine = { productId: string; quantity: number; name?: string };

/**
 * Hold stock for a pending (unpaid) order. Atomic: only succeeds when free stock covers qty.
 */
export async function reserveInventoryForLines(db: Db, lines: InventoryLine[]) {
  for (const line of lines) {
    const rows = await db.$executeRaw(
      Prisma.sql`
        UPDATE inventory
        SET reserved_qty = reserved_qty + ${line.quantity}
        WHERE product_id = ${line.productId}
          AND available_qty - reserved_qty >= ${line.quantity}
      `,
    );
    if (rows === 0) {
      throw new AppError(400, `Insufficient stock for ${line.name ?? "product"}`);
    }
  }
}

/**
 * Convert a reservation into a sale: decrement available and reserved together.
 */
export async function consumeInventoryReservation(db: Db, lines: InventoryLine[]) {
  for (const line of lines) {
    const rows = await db.$executeRaw(
      Prisma.sql`
        UPDATE inventory
        SET available_qty = available_qty - ${line.quantity},
            reserved_qty = reserved_qty - ${line.quantity}
        WHERE product_id = ${line.productId}
          AND reserved_qty >= ${line.quantity}
          AND available_qty >= ${line.quantity}
      `,
    );
    if (rows === 0) {
      throw new AppError(400, `Could not consume reserved stock for ${line.name ?? "product"}`);
    }
  }
}

/**
 * Release a hold when payment fails or the unpaid order is cancelled.
 * No-op (0 rows) if already released — safe for salvage / double-cancel.
 */
export async function releaseInventoryReservation(db: Db, lines: InventoryLine[]) {
  for (const line of lines) {
    await db.$executeRaw(
      Prisma.sql`
        UPDATE inventory
        SET reserved_qty = reserved_qty - ${line.quantity}
        WHERE product_id = ${line.productId}
          AND reserved_qty >= ${line.quantity}
      `,
    );
  }
}

/** Load order item lines for reservation ops. */
export async function loadOrderInventoryLines(db: Db, orderId: string): Promise<InventoryLine[]> {
  const items = await db.orderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true, productName: true },
  });
  return items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    name: i.productName,
  }));
}

/**
 * Debit available stock immediately (wallet checkout — no prior reservation).
 * Respects reserved qty so free stock = available - reserved.
 */
export async function decrementAvailableStock(db: Db, lines: InventoryLine[]) {
  for (const line of lines) {
    const rows = await db.$executeRaw(
      Prisma.sql`
        UPDATE inventory
        SET available_qty = available_qty - ${line.quantity}
        WHERE product_id = ${line.productId}
          AND available_qty - reserved_qty >= ${line.quantity}
      `,
    );
    if (rows === 0) {
      throw new AppError(400, `Insufficient stock for ${line.name ?? "product"}`);
    }
  }
}
