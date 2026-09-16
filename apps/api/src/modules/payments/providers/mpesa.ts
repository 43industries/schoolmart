import { createHash, randomUUID } from "node:crypto";
import { config } from "../../../config.js";
import { AppError, ValidationError } from "../../../lib/errors.js";
import type {
  PaymentProvider,
  ProviderInitiateInput,
  ProviderInitiateResult,
  ProviderWebhookResult,
} from "./types.js";

function darajaBaseUrl() {
  return config.mpesa.env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function hasDarajaCredentials() {
  const { consumerKey, consumerSecret, shortcode, passkey, callbackUrl } = config.mpesa;
  return Boolean(consumerKey && consumerSecret && shortcode && passkey && callbackUrl);
}

async function getAccessToken(): Promise<string> {
  const { consumerKey, consumerSecret } = config.mpesa;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(`${darajaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new AppError(502, "M-PESA auth failed");
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new AppError(502, "M-PESA auth token missing");
  return data.access_token;
}

function stkPassword(timestamp: string) {
  const { shortcode, passkey } = config.mpesa;
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

function timestampNow() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function toMpesaPhone(phoneE164: string) {
  // 2547XXXXXXXX
  return phoneE164.replace(/^\+/, "");
}

/**
 * Daraja STK Push provider. When credentials are missing, falls back to a
 * processing intent that must be completed via mock complete / webhook.
 */
export const mpesaPaymentProvider: PaymentProvider = {
  name: "mpesa",

  async initiate(input: ProviderInitiateInput): Promise<ProviderInitiateResult> {
    if (input.method !== "MPESA") {
      // Non-M-PESA rails still go through mock-shaped flow under this provider switch
      const providerRef = `mpesa-rail-${input.method.toLowerCase()}-${randomUUID()}`;
      return {
        provider: "mpesa",
        providerRef,
        status: "PROCESSING",
        instructions: `${input.method} rail queued (PSP not wired). Confirm via mock complete for now.`,
      };
    }

    if (!input.phoneE164) {
      throw new ValidationError("M-PESA phone number is required");
    }

    if (!hasDarajaCredentials()) {
      const providerRef = `mpesa-pending-${randomUUID()}`;
      return {
        provider: "mpesa",
        providerRef,
        status: "PROCESSING",
        instructions:
          "Daraja credentials not configured. Payment is pending — use mock complete or set MPESA_* env vars.",
        raw: { configured: false },
      };
    }

    const token = await getAccessToken();
    const timestamp = timestampNow();
    const amountKes = Math.max(1, Math.round(input.amountMinor / 100));
    const body = {
      BusinessShortCode: config.mpesa.shortcode,
      Password: stkPassword(timestamp),
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amountKes,
      PartyA: toMpesaPhone(input.phoneE164),
      PartyB: config.mpesa.shortcode,
      PhoneNumber: toMpesaPhone(input.phoneE164),
      CallBackURL: config.mpesa.callbackUrl,
      AccountReference: String(input.metadata?.accountRef ?? "SchoolMart").slice(0, 12),
      TransactionDesc: String(input.metadata?.description ?? "SchoolMart payment").slice(0, 13),
    };

    const res = await fetch(`${darajaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new AppError(502, "M-PESA STK push failed");
    }

    const checkoutId =
      (raw as { CheckoutRequestID?: string }).CheckoutRequestID ??
      `mpesa-${createHash("sha256").update(JSON.stringify(raw)).digest("hex").slice(0, 24)}`;

    return {
      provider: "mpesa",
      providerRef: checkoutId,
      status: "PROCESSING",
      instructions: "STK push sent. Approve on your phone.",
      raw,
    };
  },

  async parseWebhook(body: unknown): Promise<ProviderWebhookResult> {
    const payload = body as {
      Body?: {
        stkCallback?: {
          CheckoutRequestID?: string;
          ResultCode?: number;
        };
      };
      providerRef?: string;
      status?: string;
    };

    const cb = payload.Body?.stkCallback;
    if (cb?.CheckoutRequestID) {
      return {
        providerRef: cb.CheckoutRequestID,
        status: cb.ResultCode === 0 ? "SUCCEEDED" : "FAILED",
        raw: body,
      };
    }

    if (payload.providerRef && (payload.status === "SUCCEEDED" || payload.status === "FAILED")) {
      return {
        providerRef: payload.providerRef,
        status: payload.status,
        raw: body,
      };
    }

    throw new ValidationError("Unrecognized M-PESA webhook payload");
  },
};
