import { prisma, PaymentMethod, PaymentStatus } from "@schoolmart/db";
import { getProviderByName } from "./providers/index.js";
import { completeIntent } from "./payments.service.js";
import type { AuditContext } from "../audit/audit.service.js";

/** Daraja STK prompts expire in about a minute; allow generous slack for callbacks. */
const LIVE_MPESA_TIMEOUT_MS = 10 * 60 * 1000;
/** Mock / not-yet-wired rails wait for a manual confirm. */
const OFFLINE_RAIL_TIMEOUT_MS = 60 * 60 * 1000;
/** Avoid querying Daraja before the customer has had a chance to respond. */
const MIN_AGE_BEFORE_QUERY_MS = 20 * 1000;

const SYSTEM_CTX: AuditContext = { userAgent: "payments-reconciler" };

type OpenPayment = {
  id: string;
  provider: string;
  providerRef: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: Date;
};

function isLiveMpesa(p: OpenPayment) {
  return p.provider === "mpesa" && p.method === PaymentMethod.MPESA;
}

/**
 * Bring one open payment up to date: ask the provider when supported, and fail it
 * once it is older than the rail's timeout. Returns the resulting status.
 */
export async function reconcilePayment(payment: OpenPayment, ctx: AuditContext = SYSTEM_CTX) {
  if (payment.status !== PaymentStatus.PROCESSING && payment.status !== PaymentStatus.PENDING) {
    return payment.status;
  }
  if (!payment.providerRef) return payment.status;

  const age = Date.now() - payment.createdAt.getTime();

  if (isLiveMpesa(payment) && age >= MIN_AGE_BEFORE_QUERY_MS) {
    const provider = getProviderByName(payment.provider);
    if (provider?.queryStatus) {
      try {
        const result = await provider.queryStatus(payment.providerRef);
        if (result.status !== "PROCESSING") {
          const done = await completeIntent(
            {
              providerRef: payment.providerRef,
              status: result.status,
              reason: result.status === "FAILED" ? result.resultDesc : undefined,
              source: "reconcile",
            },
            ctx,
          );
          return done.payment.status as PaymentStatus;
        }
      } catch {
        // Provider unreachable — fall through to timeout handling.
      }
    }
  }

  const timeout = isLiveMpesa(payment) ? LIVE_MPESA_TIMEOUT_MS : OFFLINE_RAIL_TIMEOUT_MS;
  if (age >= timeout) {
    const done = await completeIntent(
      {
        providerRef: payment.providerRef,
        status: "FAILED",
        reason: "Payment timed out without confirmation",
        source: "timeout",
      },
      ctx,
    );
    return done.payment.status as PaymentStatus;
  }

  return payment.status;
}

export async function reconcileOpenPayments(limit = 50, ctx: AuditContext = SYSTEM_CTX) {
  const open = await prisma.payment.findMany({
    where: {
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
      provider: { not: "wallet" },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, provider: true, providerRef: true, method: true, status: true, createdAt: true },
  });

  const summary = { checked: open.length, succeeded: 0, failed: 0, stillOpen: 0 };
  for (const p of open) {
    const status = await reconcilePayment(p, ctx);
    if (status === PaymentStatus.SUCCEEDED) summary.succeeded++;
    else if (status === PaymentStatus.FAILED) summary.failed++;
    else summary.stillOpen++;
  }
  return summary;
}

let timer: NodeJS.Timeout | null = null;

export function startPaymentReconciler(intervalMs = 60_000, log?: (msg: string, err?: unknown) => void) {
  if (timer) return;
  let running = false;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const summary = await reconcileOpenPayments();
      if (summary.succeeded || summary.failed) {
        log?.(`Payment reconciler: ${JSON.stringify(summary)}`);
      }
    } catch (err) {
      log?.("Payment reconciler failed", err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
}

export async function listPaymentsForAdmin(params: { status?: string; needsReview?: boolean; limit?: number }) {
  const status =
    params.status && Object.values(PaymentStatus).includes(params.status as PaymentStatus)
      ? (params.status as PaymentStatus)
      : undefined;
  return prisma.payment.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(params.needsReview ? { metadata: { path: ["needsReview"], equals: true } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, params.limit ?? 50)),
    include: {
      order: { select: { id: true, orderNumber: true, status: true } },
    },
  });
}
