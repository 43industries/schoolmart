import { randomUUID } from "node:crypto";
import { ValidationError } from "../../../lib/errors.js";
import type {
  PaymentProvider,
  ProviderInitiateInput,
  ProviderInitiateResult,
  ProviderWebhookResult,
} from "./types.js";

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",

  async initiate(input: ProviderInitiateInput): Promise<ProviderInitiateResult> {
    const providerRef = `mock-${input.purpose.toLowerCase()}-${randomUUID()}`;
    const rail = input.method.toLowerCase();
    return {
      provider: "mock",
      providerRef,
      status: "PROCESSING",
      instructions:
        input.method === "MPESA"
          ? `Mock STK push queued${input.phoneE164 ? ` to ${input.phoneE164}` : ""}. Confirm payment to complete.`
          : `Mock ${rail} payment queued. Confirm payment to complete.`,
      raw: { mock: true, amountMinor: input.amountMinor },
    };
  },

  async parseWebhook(body: unknown): Promise<ProviderWebhookResult> {
    const payload = body as { providerRef?: string; status?: string };
    if (!payload.providerRef || (payload.status !== "SUCCEEDED" && payload.status !== "FAILED")) {
      throw new ValidationError("Webhook body must include providerRef and status");
    }
    return { providerRef: payload.providerRef, status: payload.status };
  },
};
