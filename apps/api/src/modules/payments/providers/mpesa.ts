import { createHash, randomUUID } from "node:crypto";
import { config } from "../../../config.js";
import { AppError, ValidationError } from "../../../lib/errors.js";
import type {
  PaymentProvider,
  ProviderInitiateInput,
  ProviderInitiateResult,
  ProviderQueryResult,
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

function assertConfigured() {
  if (!hasDarajaCredentials()) {
    throw new AppError(
      503,
      "M-PESA is not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, and MPESA_CALLBACK_URL (or set PAYMENTS_PROVIDER=mock).",
    );
  }
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

/** Daraja expects YYYYMMDDHHmmss in Kenya time (UTC+3), regardless of server timezone. */
function timestampNow() {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function toMpesaPhone(phoneE164: string) {
  // 2547XXXXXXXX
  return phoneE164.replace(/^\+/, "");
}

/** STK charges whole shillings; this is the amount Safaricom will report back. */
export function mpesaChargedMinor(amountMinor: number) {
  return Math.max(1, Math.round(amountMinor / 100)) * 100;
}

type CallbackItem = { Name?: string; Value?: string | number };

function callbackValue(items: CallbackItem[] | undefined, name: string) {
  return items?.find((i) => i.Name === name)?.Value;
}

/**
 * Daraja STK Push provider. When PAYMENTS_PROVIDER=mpesa, full Daraja credentials
 * are required for M-PESA — missing config fails clearly (no silent mock success).
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

    assertConfigured();

    const token = await getAccessToken();
    const timestamp = timestampNow();
    const body = {
      BusinessShortCode: config.mpesa.shortcode,
      Password: stkPassword(timestamp),
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: mpesaChargedMinor(input.amountMinor) / 100,
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
      const message = (raw as { errorMessage?: string }).errorMessage;
      throw new AppError(502, message ? `M-PESA STK push failed: ${message}` : "M-PESA STK push failed");
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

  /** Accepts only Safaricom's STK callback shape. */
  async parseWebhook(body: unknown): Promise<ProviderWebhookResult> {
    const payload = body as {
      Body?: {
        stkCallback?: {
          CheckoutRequestID?: string;
          ResultCode?: number | string;
          ResultDesc?: string;
          CallbackMetadata?: { Item?: CallbackItem[] };
        };
      };
    };

    const cb = payload.Body?.stkCallback;
    if (!cb?.CheckoutRequestID || cb.ResultCode === undefined) {
      throw new ValidationError("Unrecognized M-PESA webhook payload");
    }

    const succeeded = Number(cb.ResultCode) === 0;
    const items = cb.CallbackMetadata?.Item;
    const amount = callbackValue(items, "Amount");
    const receipt = callbackValue(items, "MpesaReceiptNumber");

    return {
      providerRef: cb.CheckoutRequestID,
      status: succeeded ? "SUCCEEDED" : "FAILED",
      amountMinor: amount !== undefined ? Math.round(Number(amount) * 100) : undefined,
      receipt: receipt !== undefined ? String(receipt) : undefined,
      resultDesc: cb.ResultDesc,
      raw: body,
    };
  },

  async queryStatus(providerRef: string): Promise<ProviderQueryResult> {
    if (!hasDarajaCredentials() || !providerRef.startsWith("ws_")) {
      return { status: "PROCESSING" };
    }
    const token = await getAccessToken();
    const timestamp = timestampNow();
    const res = await fetch(`${darajaBaseUrl()}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.mpesa.shortcode,
        Password: stkPassword(timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: providerRef,
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      ResultCode?: string | number;
      ResultDesc?: string;
      errorCode?: string;
    };

    // Daraja returns an errorCode while the customer has not yet responded.
    if (raw.ResultCode === undefined || raw.errorCode) {
      return { status: "PROCESSING", raw };
    }
    return {
      status: Number(raw.ResultCode) === 0 ? "SUCCEEDED" : "FAILED",
      resultDesc: raw.ResultDesc,
      raw,
    };
  },
};
