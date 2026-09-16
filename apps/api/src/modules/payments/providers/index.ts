import { config } from "../../../config.js";
import { mockPaymentProvider } from "./mock.js";
import { mpesaPaymentProvider } from "./mpesa.js";
import type { PaymentProvider } from "./types.js";

const providers: Record<string, PaymentProvider> = {
  mock: mockPaymentProvider,
  mpesa: mpesaPaymentProvider,
};

export function getPaymentProvider(): PaymentProvider {
  return providers[config.paymentsProvider] ?? mockPaymentProvider;
}

export function getProviderByName(name: string): PaymentProvider | undefined {
  return providers[name];
}

export { mockPaymentProvider, mpesaPaymentProvider };
export type { PaymentProvider } from "./types.js";
