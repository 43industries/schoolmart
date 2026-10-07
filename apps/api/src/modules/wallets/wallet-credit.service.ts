import { prisma, type Prisma } from "@schoolmart/db";
import { ensureWalletForStudent } from "./wallets.service.js";

/**
 * Credit a student wallet once per (type, referenceId). Returns the resulting balance
 * and whether this call performed the credit.
 */
export async function creditStudentWallet(
  params: {
    studentId: string;
    amountMinor: number;
    type: "CREDIT_FUND" | "CREDIT_REFUND";
    description: string;
    referenceId: string;
  },
  tx?: Prisma.TransactionClient,
) {
  const wallet = await ensureWalletForStudent(params.studentId);

  const run = async (db: Prisma.TransactionClient) => {
    const existing = await db.walletTransaction.findFirst({
      where: { walletId: wallet.id, referenceId: params.referenceId, type: params.type },
    });
    if (existing) {
      const current = await db.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      return { balanceMinor: current.balanceMinor, credited: false as const };
    }
    const next = await db.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: { increment: params.amountMinor } },
    });
    await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: params.type,
        amountMinor: params.amountMinor,
        balanceAfterMinor: next.balanceMinor,
        description: params.description,
        referenceId: params.referenceId,
      },
    });
    return { balanceMinor: next.balanceMinor, credited: true as const };
  };

  return tx ? run(tx) : prisma.$transaction(run);
}
