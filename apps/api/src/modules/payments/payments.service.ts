import {
  prisma,
  LinkStatus,
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from "@schoolmart/db";
import type {
  CheckoutCartInput,
  CheckoutMethod,
  CompletePaymentInput,
  FundingMethod,
  FundWalletInput,
} from "@schoolmart/shared";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { clearCart } from "../cart/cart.service.js";
import {
  checkoutWithWallet,
  createPendingOrderFromLines,
  finalizeDirectOrderPayment,
  loadCheckoutLines,
} from "../cart/checkout.service.js";
import { ensureWalletForStudent } from "../wallets/wallets.service.js";
import { getPaymentProvider, getProviderByName } from "./providers/index.js";

const METHOD_MAP: Record<FundingMethod | Exclude<CheckoutMethod, "WALLET">, PaymentMethod> = {
  MPESA: PaymentMethod.MPESA,
  CARD: PaymentMethod.CARD,
  BANK: PaymentMethod.BANK,
  OTHER: PaymentMethod.OTHER,
};

function toDirectMethod(method: FundingMethod | Exclude<CheckoutMethod, "WALLET">): PaymentMethod {
  return METHOD_MAP[method];
}

function clientMetadata(metadata: unknown): { instructions?: string } {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const instructions = (metadata as { instructions?: unknown }).instructions;
  return typeof instructions === "string" ? { instructions } : {};
}

function serializePayment(payment: {
  id: string;
  purpose: PaymentPurpose;
  method: PaymentMethod;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  provider: string;
  providerRef: string | null;
  phoneE164: string | null;
  orderId: string | null;
  studentId: string | null;
  metadata: unknown;
  createdAt: Date;
}) {
  return {
    id: payment.id,
    purpose: payment.purpose,
    method: payment.method,
    status: payment.status,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    provider: payment.provider,
    providerRef: payment.providerRef,
    phoneE164: payment.phoneE164,
    orderId: payment.orderId,
    studentId: payment.studentId,
    metadata: clientMetadata(payment.metadata),
    createdAt: payment.createdAt,
  };
}

function mapProviderStatus(status: string): PaymentStatus {
  if (status === "SUCCEEDED") return PaymentStatus.SUCCEEDED;
  if (status === "FAILED") return PaymentStatus.FAILED;
  if (status === "PENDING") return PaymentStatus.PENDING;
  return PaymentStatus.PROCESSING;
}

async function creditWalletForFunding(payment: {
  id: string;
  studentId: string | null;
  amountMinor: number;
  providerRef: string | null;
  method: PaymentMethod;
  phoneE164: string | null;
}) {
  if (!payment.studentId) throw new ValidationError("Funding payment missing student");
  const ref = payment.providerRef ?? payment.id;
  const existing = await prisma.walletTransaction.findFirst({
    where: { referenceId: ref, type: "CREDIT_FUND" },
  });
  if (existing) {
    const wallet = await ensureWalletForStudent(payment.studentId);
    return { balanceMinor: wallet.balanceMinor, alreadyCredited: true as const };
  }

  const wallet = await ensureWalletForStudent(payment.studentId);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    const balanceAfter = current.balanceMinor + payment.amountMinor;
    const next = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: balanceAfter },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT_FUND",
        amountMinor: payment.amountMinor,
        balanceAfterMinor: balanceAfter,
        description: `${payment.method} top-up${payment.phoneE164 ? ` from ${payment.phoneE164}` : ""}`,
        referenceId: ref,
      },
    });
    return next;
  });

  return { balanceMinor: updated.balanceMinor, alreadyCredited: false as const };
}

export async function createFundingIntent(
  parentUserId: string,
  input: FundWalletInput,
  ctx: AuditContext,
) {
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentUserId_studentId: { parentUserId, studentId: input.studentId } },
  });
  if (!link || link.status !== LinkStatus.ACTIVE) {
    throw new ForbiddenError("You can only fund wallets for approved children");
  }

  if (input.method === "MPESA" && !input.phone) {
    throw new ValidationError("Phone number is required for M-PESA funding");
  }

  await ensureWalletForStudent(input.studentId);

  const method = toDirectMethod(input.method);
  const provider = getPaymentProvider();
  const initiated = await provider.initiate({
    purpose: PaymentPurpose.FUND_WALLET,
    method,
    amountMinor: input.amountMinor,
    currency: "KES",
    phoneE164: input.phone,
    metadata: { studentId: input.studentId, accountRef: "WALLET" },
  });

  const idempotencyKey = `fund-${parentUserId}-${input.studentId}-${initiated.providerRef}`;
  const payment = await prisma.payment.create({
    data: {
      purpose: PaymentPurpose.FUND_WALLET,
      method,
      status: mapProviderStatus(initiated.status),
      amountMinor: input.amountMinor,
      currency: "KES",
      parentUserId,
      studentId: input.studentId,
      actorUserId: parentUserId,
      provider: initiated.provider,
      providerRef: initiated.providerRef,
      idempotencyKey,
      phoneE164: input.phone ?? null,
      metadata: { instructions: initiated.instructions ?? null },
    },
  });

  let balanceMinor: number | undefined;
  if (payment.status === PaymentStatus.SUCCEEDED) {
    const credited = await creditWalletForFunding(payment);
    balanceMinor = credited.balanceMinor;
  }

  await writeAuditLog({
    action: "PAYMENT_FUND_INTENT_CREATED",
    resourceType: "Payment",
    resourceId: payment.id,
    metadata: {
      method: payment.method,
      amountMinor: payment.amountMinor,
      provider: payment.provider,
      status: payment.status,
    },
    context: { ...ctx, actorUserId: parentUserId },
  });

  return {
    payment: serializePayment(payment),
    instructions: initiated.instructions,
    balanceMinor,
    requiresConfirmation:
      payment.status === PaymentStatus.PROCESSING || payment.status === PaymentStatus.PENDING,
  };
}

export async function createCheckoutIntent(
  parentUserId: string,
  input: CheckoutCartInput,
  ctx: AuditContext,
) {
  const method = input.paymentMethod ?? "WALLET";

  if (method === "WALLET") {
    return checkoutWithWallet(parentUserId, input, ctx);
  }

  if (method === "MPESA" && !input.phone) {
    throw new ValidationError("Phone number is required for M-PESA checkout");
  }

  const { lines, subtotalMinor } = await loadCheckoutLines(
    parentUserId,
    input.schoolId,
    input.studentId,
  );

  const prismaMethod = toDirectMethod(method);
  const provider = getPaymentProvider();
  const initiated = await provider.initiate({
    purpose: PaymentPurpose.ORDER_CHECKOUT,
    method: prismaMethod,
    amountMinor: subtotalMinor,
    currency: "KES",
    phoneE164: input.phone,
    metadata: { studentId: input.studentId, accountRef: "ORDER" },
  });

  const order = await createPendingOrderFromLines({
    parentUserId,
    studentId: input.studentId,
    schoolId: input.schoolId,
    lines,
    subtotalMinor,
    notes: input.notes,
    payment: {
      method: prismaMethod,
      provider: initiated.provider,
      providerRef: initiated.providerRef,
      phoneE164: input.phone,
      instructions: initiated.instructions,
    },
  });

  await writeAuditLog({
    action: "PAYMENT_CHECKOUT_INTENT_CREATED",
    resourceType: "Order",
    resourceId: order.id,
    metadata: {
      method: prismaMethod,
      providerRef: initiated.providerRef,
      totalMinor: subtotalMinor,
    },
    context: { ...ctx, actorUserId: parentUserId },
  });

  const payment = order.payments[0];
  return {
    status: "PENDING_PAYMENT" as const,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      totalMinor: order.totalMinor,
      status: order.status,
    },
    payment: payment ? serializePayment(payment) : null,
    instructions: initiated.instructions,
    requiresConfirmation: true,
  };
}

export async function completeIntent(input: CompletePaymentInput, ctx: AuditContext) {
  const payment = await prisma.payment.findFirst({
    where: { providerRef: input.providerRef },
    include: { order: true },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  if (payment.status === PaymentStatus.SUCCEEDED || payment.status === PaymentStatus.FAILED) {
    return {
      payment: serializePayment(payment),
      alreadyFinal: true as const,
    };
  }

  if (input.status === "FAILED") {
    const failed = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    if (payment.orderId && payment.order?.status === OrderStatus.PENDING_PAYMENT) {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await prisma.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.CANCELLED,
          actorUserId: payment.actorUserId,
          note: "Payment failed",
        },
      });
    }
    await writeAuditLog({
      action: "PAYMENT_FAILED",
      resourceType: "Payment",
      resourceId: payment.id,
      context: ctx,
    });
    return { payment: serializePayment(failed), alreadyFinal: false as const };
  }

  const succeeded = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.SUCCEEDED },
  });

  let balanceMinor: number | undefined;
  let orderResult: { id: string; orderNumber: string; totalMinor: number; status: string } | undefined;

  if (payment.purpose === PaymentPurpose.FUND_WALLET) {
    const credited = await creditWalletForFunding(succeeded);
    balanceMinor = credited.balanceMinor;
  } else if (payment.purpose === PaymentPurpose.ORDER_CHECKOUT && payment.orderId) {
    const order = await finalizeDirectOrderPayment(
      payment.orderId,
      payment.actorUserId ?? payment.parentUserId,
    );
    if (payment.parentUserId) {
      await clearCart(payment.parentUserId);
    }
    orderResult = {
      id: order.id,
      orderNumber: order.orderNumber,
      totalMinor: order.totalMinor,
      status: order.status,
    };
  }

  await writeAuditLog({
    action: "PAYMENT_SUCCEEDED",
    resourceType: "Payment",
    resourceId: payment.id,
    metadata: { purpose: payment.purpose, orderId: payment.orderId },
    context: ctx,
  });

  return {
    payment: serializePayment(succeeded),
    balanceMinor,
    order: orderResult,
    alreadyFinal: false as const,
  };
}

export async function handleProviderWebhook(providerName: string, body: unknown, ctx: AuditContext) {
  const provider = getProviderByName(providerName) ?? getPaymentProvider();
  if (!provider.parseWebhook) {
    throw new ValidationError(`Provider ${providerName} does not support webhooks`);
  }
  const parsed = await provider.parseWebhook(body);
  return completeIntent({ providerRef: parsed.providerRef, status: parsed.status }, ctx);
}
