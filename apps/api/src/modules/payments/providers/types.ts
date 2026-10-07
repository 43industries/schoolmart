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
  /** Amount the provider reports as actually paid, in minor units */
  amountMinor?: number;
  /** Provider receipt, e.g. M-PESA receipt number */
  receipt?: string;
  resultDesc?: string;
  raw?: unknown;
};

export type ProviderQueryResult = {
  status: "SUCCEEDED" | "FAILED" | "PROCESSING";
  resultDesc?: string;
  raw?: unknown;
};

export interface PaymentProvider {
  name: string;
  initiate(input: ProviderInitiateInput): Promise<ProviderInitiateResult>;
  parseWebhook?(body: unknown): Promise<ProviderWebhookResult>;
  /** Ask the provider for the current status of an intent (reconciliation). */
  queryStatus?(providerRef: string): Promise<ProviderQueryResult>;
}
