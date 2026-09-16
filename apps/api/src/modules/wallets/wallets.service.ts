import { prisma, LinkStatus } from "@schoolmart/db";
import type { UpsertWalletRuleInput } from "@schoolmart/shared";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

async function assertActiveParentLink(parentUserId: string, studentId: string) {
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentUserId_studentId: { parentUserId, studentId } },
  });
  if (!link || link.status !== LinkStatus.ACTIVE) {
    throw new ForbiddenError("You can only manage wallets for approved children");
  }
  return link;
}

export async function ensureWalletForStudent(studentId: string) {
  return prisma.wallet.upsert({
    where: { studentId },
    create: { studentId, balanceMinor: 0, currency: "KES" },
    update: {},
  });
}

export async function listParentWallets(parentUserId: string) {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId, status: LinkStatus.ACTIVE },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          school: { select: { id: true, name: true } },
          wallet: {
            include: {
              rules: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const wallets = [];
  for (const link of links) {
    const ensured = link.student.wallet
      ? link.student.wallet
      : await ensureWalletForStudent(link.student.id).then(async (w) =>
          prisma.wallet.findUniqueOrThrow({
            where: { id: w.id },
            include: { rules: { orderBy: { createdAt: "asc" } } },
          }),
        );

    wallets.push({
      studentId: link.student.id,
      student: {
        id: link.student.id,
        firstName: link.student.firstName,
        lastName: link.student.lastName,
        studentNumber: link.student.studentNumber,
        school: link.student.school,
      },
      wallet: {
        id: ensured.id,
        balanceMinor: ensured.balanceMinor,
        currency: ensured.currency,
        lowBalanceThresholdMinor: ensured.lowBalanceThresholdMinor,
        rules: ensured.rules.map((r) => ({
          id: r.id,
          category: r.category,
          period: r.period,
          limitMinor: r.limitMinor,
          requiresApproval: r.requiresApproval,
        })),
        updatedAt: ensured.updatedAt,
      },
    });
  }

  return wallets;
}

export async function getParentWallet(parentUserId: string, studentId: string) {
  await assertActiveParentLink(parentUserId, studentId);
  const wallet = await ensureWalletForStudent(studentId);

  const full = await prisma.wallet.findUniqueOrThrow({
    where: { id: wallet.id },
    include: {
      rules: { orderBy: { createdAt: "asc" } },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          school: { select: { id: true, name: true } },
        },
      },
      transactions: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  return {
    studentId: full.student.id,
    student: full.student,
    wallet: {
      id: full.id,
      balanceMinor: full.balanceMinor,
      currency: full.currency,
      lowBalanceThresholdMinor: full.lowBalanceThresholdMinor,
      rules: full.rules,
      transactions: full.transactions,
      updatedAt: full.updatedAt,
    },
  };
}

export async function upsertWalletRule(
  parentUserId: string,
  input: UpsertWalletRuleInput,
  ctx: AuditContext,
) {
  await assertActiveParentLink(parentUserId, input.studentId);
  const wallet = await ensureWalletForStudent(input.studentId);

  const existing = await prisma.walletRule.findFirst({
    where: {
      walletId: wallet.id,
      category: input.category,
      period: input.period,
    },
  });

  const rule = existing
    ? await prisma.walletRule.update({
        where: { id: existing.id },
        data: {
          limitMinor: input.limitMinor,
          requiresApproval: input.requiresApproval,
        },
      })
    : await prisma.walletRule.create({
        data: {
          walletId: wallet.id,
          category: input.category,
          period: input.period,
          limitMinor: input.limitMinor,
          requiresApproval: input.requiresApproval,
        },
      });

  await writeAuditLog({
    action: "WALLET_RULE_UPSERTED",
    resourceType: "WalletRule",
    resourceId: rule.id,
    metadata: input,
    context: { ...ctx, actorUserId: parentUserId },
  });

  return rule;
}

export async function deleteWalletRule(parentUserId: string, ruleId: string, ctx: AuditContext) {
  const rule = await prisma.walletRule.findUnique({
    where: { id: ruleId },
    include: { wallet: true },
  });
  if (!rule) throw new NotFoundError("Wallet rule not found");

  await assertActiveParentLink(parentUserId, rule.wallet.studentId);
  await prisma.walletRule.delete({ where: { id: ruleId } });

  await writeAuditLog({
    action: "WALLET_RULE_DELETED",
    resourceType: "WalletRule",
    resourceId: ruleId,
    context: { ...ctx, actorUserId: parentUserId },
  });

  return { success: true };
}
