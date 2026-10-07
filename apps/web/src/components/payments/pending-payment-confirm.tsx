"use client";

import { Button } from "@/components/ui/button";

type PendingPaymentConfirmProps = {
  hint: string;
  busy?: boolean;
  /** When true, show waiting copy instead of mock confirm button */
  waitingForPhone?: boolean;
  onConfirm?: () => void;
  confirmLabel?: string;
};

export function PendingPaymentConfirm({
  hint,
  busy = false,
  waitingForPhone = false,
  onConfirm,
  confirmLabel = "Confirm payment",
}: PendingPaymentConfirmProps) {
  return (
    <div className="space-y-2 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-3 py-3">
      <p className="text-sm text-brand-ink">{hint}</p>
      {waitingForPhone ? (
        <p className="text-sm font-medium text-brand-teal">
          {busy ? "Checking payment status…" : "Waiting for phone approval…"}
        </p>
      ) : onConfirm ? (
        <Button type="button" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      ) : null}
    </div>
  );
}
