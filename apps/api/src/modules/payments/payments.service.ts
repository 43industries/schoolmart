import {
  prisma,
  LinkStatus,
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  type Prisma,
} from "@schoolmart/db";
import type {
  CheckoutCartInput,
  CheckoutMethod,
  CompletePaymentInput,
  FundingMethod,
  FundWalletInput,
} from "@schoolmart/shared";
import { formatKES } from "@schoolmart/shared";
import { notifyUser } from "../notifications/notifications.service.js";
import { creditStudentWallet } from "../wallets/wallet-credit.service.js";
import { mpesaChargedMinor } from "./providers/mpesa.js";
import { reconcilePayment } from "./payments.reconcile.js";
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
  const result = await creditStudentWallet({
    studentId: payment.studentId,
    amountMinor: payment.amountMinor,
    type: "CREDIT_FUND",
    description: `${payment.method} top-up${payment.phoneE164 ? ` from ${payment.phoneE164}` : ""}`,
    referenceId: payment.providerRef ?? payment.id,
  });
  return { balanceMinor: result.balanceMinor, alreadyCredited: !result.credited };
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

export type CompleteIntentInput = CompletePaymentInput & {
  /** Amount the provider says was paid; verified against the intent when present. */
  amountMinor?: number;
  receipt?: string;
  reason?: string;
  source?: "mock" | "webhook" | "reconcile" | "timeout" | "parent_cancel";
};

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function expectedProviderAmount(payment: { provider: string; method: PaymentMethod; amountMinor: number }) {
  return payment.provider === "mpesa" && payment.method === PaymentMethod.MPESA
    ? mpesaChargedMinor(payment.amountMinor)
    : payment.amountMinor;
}

const OPEN_PAYMENT_STATUSES: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.PROCESSING];
const PAYABLE_ORDER_STATUSES: OrderStatus[] = [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_PROCESSING];

export async function completeIntent(input: CompleteIntentInput, ctx: AuditContext) {
  const payment = await prisma.payment.findFirst({
    where: { providerRef: input.providerRef },
    include: { order: true },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  if (!OPEN_PAYMENT_STATUSES.includes(payment.status)) {
    return { payment: serializePayment(payment), alreadyFinal: true as const };
  }

  let outcome: "SUCCEEDED" | "FAILED" = input.status;
  let reviewReason: string | undefined;

  if (outcome === "SUCCEEDED" && input.amountMinor !== undefined) {
    const expected = expectedProviderAmount(payment);
    if (input.amountMinor !== expected) {
      outcome = "FAILED";
      reviewReason = `Amount mismatch: expected ${expected}, provider reported ${input.amountMinor}`;
    }
  }

  if (outcome === "SUCCEEDED" && input.receipt) {
    const duplicate = await prisma.payment.findFirst({
      where: {
        id: { not: payment.id },
        metadata: { path: ["receipt"], equals: input.receipt },
      },
      select: { id: true },
    });
    if (duplicate) {
      outcome = "FAILED";
      reviewReason = `Receipt ${input.receipt} already applied to payment ${duplicate.id}`;
    }
  }

  const metadata = metadataObject(payment.metadata);
  if (input.receipt) metadata.receipt = input.receipt;
  if (input.amountMinor !== undefined) metadata.providerAmountMinor = input.amountMinor;
  if (input.source) metadata.completedVia = input.source;
  if (input.reason) metadata.failureReason = input.reason;
  if (reviewReason) {
    metadata.needsReview = true;
    metadata.reviewReason = reviewReason;
  }

  // Claim the payment atomically so concurrent webhook + reconcile calls apply it once.
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: OPEN_PAYMENT_STATUSES } },
    data: {
      status: outcome === "SUCCEEDED" ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
  const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  if (claimed.count === 0) {
    return { payment: serializePayment(updated), alreadyFinal: true as const };
  }

  if (outcome === "FAILED") {
    if (payment.orderId && payment.order && PAYABLE_ORDER_STATUSES.includes(payment.order.status)) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: payment.orderId! },
          data: { status: OrderStatus.CANCELLED },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId!,
            fromStatus: payment.order!.status,
            toStatus: OrderStatus.CANCELLED,
            actorUserId: payment.actorUserId,
            note: input.reason ?? reviewReason ?? "Payment failed",
          },
        });
      });
    }
    await notifyUser({
      userId: payment.parentUserId,
      title: "Payment not completed",
      body: payment.order
        ? `Payment for order ${payment.order.orderNumber} did not complete${input.reason ? ` (${input.reason})` : ""}.`
        : `Your ${payment.method} wallet top-up did not complete${input.reason ? ` (${input.reason})` : ""}.`,
      metadata: { paymentId: payment.id, orderId: payment.orderId },
    });
    await writeAuditLog({
      action: reviewReason ? "PAYMENT_FLAGGED_FOR_REVIEW" : "PAYMENT_FAILED",
      resourceType: "Payment",
      resourceId: payment.id,
      metadata: { source: input.source, reason: input.reason ?? reviewReason },
      context: ctx,
    });
    return { payment: serializePayment(updated), alreadyFinal: false as const };
  }

  let balanceMinor: number | undefined;
  let orderResult: { id: string; orderNumber: string; totalMinor: number; status: string } | undefined;

  if (payment.purpose === PaymentPurpose.FUND_WALLET) {
    const credited = await creditWalletForFunding(updated);
    balanceMinor = credited.balanceMinor;
    await notifyUser({
      userId: payment.parentUserId,
      title: "Wallet funded",
      body: `${formatKES(payment.amountMinor)} was added to your child's wallet.`,
      metadata: { paymentId: payment.id, studentId: payment.studentId },
    });
  } else if (payment.purpose === PaymentPurpose.ORDER_CHECKOUT && payment.orderId && payment.order) {
    const finalized = await finalizeOrSalvage(payment, ctx);
    orderResult = finalized.order;
    balanceMinor = finalized.balanceMinor;
    if (finalized.paid && payment.parentUserId) {
      await clearCart(payment.parentUserId);
    }
  }

  await writeAuditLog({
    action: "PAYMENT_SUCCEEDED",
    resourceType: "Payment",
    resourceId: payment.id,
    metadata: { purpose: payment.purpose, orderId: payment.orderId, source: input.source },
    context: ctx,
  });

  return {
    payment: serializePayment(updated),
    balanceMinor,
    order: orderResult,
    alreadyFinal: false as const,
  };
}

/**
 * Money arrived for an order. Mark it PAID; if the order can no longer be paid
 * (cancelled, timed out, stock problem) credit the child's wallet instead so funds are never lost.
 */
async function finalizeOrSalvage(
  payment: {
    id: string;
    orderId: string | null;
    studentId: string | null;
    parentUserId: string | null;
    actorUserId: string | null;
    amountMinor: number;
    order: { id: string; orderNumber: string; totalMinor: number; status: OrderStatus } | null;
  },
  ctx: AuditContext,
) {
  const order = payment.order!;
  if (PAYABLE_ORDER_STATUSES.includes(order.status)) {
    try {
      const paid = await finalizeDirectOrderPayment(order.id, payment.actorUserId ?? payment.parentUserId);
      await notifyUser({
        userId: payment.parentUserId,
        title: "Order paid",
        body: `Order ${paid.orderNumber} is paid and has been sent to the vendor.`,
        metadata: { orderId: paid.id },
      });
      return {
        paid: true,
        order: { id: paid.id, orderNumber: paid.orderNumber, totalMinor: paid.totalMinor, status: paid.status },
        balanceMinor: undefined,
      };
    } catch (err) {
      await writeAuditLog({
        action: "ORDER_FINALIZE_FAILED",
        resourceType: "Order",
        resourceId: order.id,
        metadata: { paymentId: payment.id, error: (err as Error).message },
        context: ctx,
      });
    }
  }

  const studentId = payment.studentId;
  let balanceMinor: number | undefined;
  if (studentId) {
    const credited = await creditStudentWallet({
      studentId,
      amountMinor: payment.amountMinor,
      type: "CREDIT_REFUND",
      description: `Payment for ${order.orderNumber} received after the order closed — credited to wallet`,
      referenceId: `late-payment-${payment.id}`,
    });
    balanceMinor = credited.balanceMinor;
  }
  await writeAuditLog({
    action: "PAYMENT_LATE_CREDITED_TO_WALLET",
    resourceType: "Payment",
    resourceId: payment.id,
    metadata: { orderId: order.id, orderStatus: order.status, amountMinor: payment.amountMinor },
    context: ctx,
  });
  await notifyUser({
    userId: payment.parentUserId,
    title: "Payment credited to wallet",
    body: `We received ${formatKES(payment.amountMinor)} for order ${order.orderNumber}, but the order had already closed. The amount was added to your child's wallet.`,
    metadata: { orderId: order.id, paymentId: payment.id },
  });
  return {
    paid: false,
    order: { id: order.id, orderNumber: order.orderNumber, totalMinor: order.totalMinor, status: order.status },
    balanceMinor,
  };
}

export async function handleProviderWebhook(providerName: string, body: unknown, ctx: AuditContext) {
  const provider = getProviderByName(providerName);
  if (!provider?.parseWebhook) {
    throw new ValidationError(`Provider ${providerName} does not support webhooks`);
  }
  const parsed = await provider.parseWebhook(body);
  return completeIntent(
    {
      providerRef: parsed.providerRef,
      status: parsed.status,
      amountMinor: parsed.amountMinor,
      receipt: parsed.receipt,
      reason: parsed.status === "FAILED" ? parsed.resultDesc : undefined,
      source: "webhook",
    },
    ctx,
  );
}

export async function getPaymentStatusForParent(parentUserId: string, paymentId: string) {
  const current = await prisma.payment.findFirst({ where: { id: paymentId, parentUserId } });
  if (!current) throw new NotFoundError("Payment not found");
  await reconcilePayment(current);

  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      order: { select: { id: true, orderNumber: true, totalMinor: true, status: true } },
    },
  });

  let balanceMinor: number | undefined;
  if (
    payment.purpose === PaymentPurpose.FUND_WALLET &&
    payment.status === PaymentStatus.SUCCEEDED &&
    payment.studentId
  ) {
    const wallet = await ensureWalletForStudent(payment.studentId);
    balanceMinor = wallet.balanceMinor;
  }

  return {
    payment: serializePayment(payment),
    order: payment.order
      ? {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          totalMinor: payment.order.totalMinor,
          status: payment.order.status,
        }
      : undefined,
    balanceMinor,
  };
}
