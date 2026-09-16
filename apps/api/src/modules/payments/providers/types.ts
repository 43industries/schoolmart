import type { PaymentMethod, PaymentPurpose } from "@schoolmart/db";

export type ProviderInitiateInput = {
  purpose: PaymentPurpose;
  method: PaymentMethod;
  amountMinor: number;
  currency: string;
  phoneE164?: string | null;
  metadata?: Record<string, unknown>;
};

export type ProviderInitiateResult = {
  provider: string;
  providerRef: string;
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  instructions?: string;
  raw?: unknown;
};

export type ProviderWebhookResult = {
  providerRef: string;
  status: "SUCCEEDED" | "FAILED";
  raw?: unknown;
};

export interface PaymentProvider {
  name: string;
  initiate(input: ProviderInitiateInput): Promise<ProviderInitiateResult>;
  parseWebhook?(body: unknown): Promise<ProviderWebhookResult>;
}
