import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { completePaymentSchema } from "@schoolmart/shared";
import { PaymentMethod, prisma } from "@schoolmart/db";
import { authenticate, requireParent } from "../../middleware/auth.js";
import { auditContextFromRequest, writeAuditLog } from "../audit/audit.service.js";
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { config } from "../../config.js";
import {
  completeIntent,
  getPaymentStatusForParent,
  handleProviderWebhook,
} from "./payments.service.js";

function tokenMatches(given: string | undefined, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function assertWebhookAllowed(provider: string, token: string | undefined) {
  if (provider === "mpesa") {
    const expected = config.mpesa.webhookToken;
    if (!expected) {
      if (!config.isDev) throw new AppError(503, "MPESA_WEBHOOK_TOKEN is not configured");
      return;
    }
    if (!tokenMatches(token, expected)) throw new UnauthorizedError("Invalid webhook token");
    return;
  }
  if (provider === "mock") {
    if (!config.isDev) throw new ForbiddenError("Mock webhooks are disabled outside development");
    return;
  }
  throw new NotFoundError("Unknown payment provider");
}

async function handleWebhook(req: FastifyRequest, provider: string, token: string | undefined) {
  try {
    assertWebhookAllowed(provider, token);
  } catch (err) {
    await writeAuditLog({
      action: "PAYMENT_WEBHOOK_REJECTED",
      resourceType: "Payment",
      metadata: { provider, reason: (err as Error).message },
      context: auditContextFromRequest(req),
    });
    throw err;
  }

  try {
    await handleProviderWebhook(provider, req.body, auditContextFromRequest(req));
  } catch (err) {
    // Unknown intents / malformed bodies are acknowledged so the provider stops retrying;
    // anything else bubbles up as 5xx so the provider retries later.
    if (err instanceof NotFoundError || err instanceof ValidationError) {
      req.log.warn({ provider, err: (err as Error).message }, "Payment webhook ignored");
      return;
    }
    throw err;
  }
}

export async function paymentRoutes(app: FastifyInstance) {
  /** Dev/mock confirm — blocked for live Daraja M-PESA intents (webhook completes those). */
  app.post("/mock/complete", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = completePaymentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const existing = await prisma.payment.findFirst({
      where: { providerRef: parsed.data.providerRef, parentUserId: req.user!.sub },
    });
    if (!existing) throw new NotFoundError("Payment not found");
    if (existing.method === PaymentMethod.MPESA && existing.provider === "mpesa") {
      throw new ForbiddenError(
        "Live M-PESA payments complete via Safaricom callback. Approve the STK prompt on your phone.",
      );
    }

    const result = await completeIntent(
      { ...parsed.data, source: "mock" },
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(result);
  });

  app.get("/:id", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await getPaymentStatusForParent(req.user!.sub, id);
    return reply.send(result);
  });

  app.post("/webhooks/:provider/:token", async (req, reply) => {
    const { provider, token } = req.params as { provider: string; token: string };
    await handleWebhook(req, provider, token);
    return reply.send({ ResultCode: 0, ResultDesc: "Accepted" });
  });

  app.post("/webhooks/:provider", async (req, reply) => {
    const { provider } = req.params as { provider: string };
    await handleWebhook(req, provider, undefined);
    return reply.send({ ResultCode: 0, ResultDesc: "Accepted" });
  });
}
