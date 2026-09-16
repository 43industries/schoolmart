import type { FastifyInstance } from "fastify";
import { fundWalletSchema, upsertWalletRuleSchema, approveWalletSpendSchema } from "@schoolmart/shared";
import { authenticate, requireParent } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";
import {
  listParentWallets,
  getParentWallet,
  upsertWalletRule,
  deleteWalletRule,
} from "./wallets.service.js";
import { listPendingSpendRequests, reviewWalletSpend } from "./wallet-spend.service.js";
import { createFundingIntent } from "../payments/payments.service.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/wallets", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const wallets = await listParentWallets(req.user!.sub);
    return reply.send({ wallets });
  });

  app.get("/wallets/spend-requests", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const requests = await listPendingSpendRequests(req.user!.sub);
    return reply.send({ requests });
  });

  app.post("/wallets/spend-requests/review", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = approveWalletSpendSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    const result = await reviewWalletSpend(
      req.user!.sub,
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(result);
  });

  app.get("/wallets/:studentId", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const { studentId } = req.params as { studentId: string };
    const wallet = await getParentWallet(req.user!.sub, studentId);
    return reply.send(wallet);
  });

  app.post("/wallets/fund", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = fundWalletSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const result = await createFundingIntent(
      req.user!.sub,
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.status(201).send(result);
  });

  app.put("/wallets/rules", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = upsertWalletRuleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const rule = await upsertWalletRule(
      req.user!.sub,
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(rule);
  });

  app.delete("/wallets/rules/:ruleId", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const { ruleId } = req.params as { ruleId: string };
    const result = await deleteWalletRule(
      req.user!.sub,
      ruleId,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(result);
  });
}
