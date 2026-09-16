"use client";

import { Button } from "@/components/ui/button";

type PendingPaymentConfirmProps = {
  hint: string;
  busy?: boolean;
  onConfirm: () => void;
  confirmLabel?: string;
};

export function PendingPaymentConfirm({
  hint,
  busy = false,
  onConfirm,
  confirmLabel = "Confirm payment",
}: PendingPaymentConfirmProps) {
  return (
    <div className="space-y-2 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-3 py-3">
      <p className="text-sm text-brand-ink">{hint}</p>
      <Button type="button" disabled={busy} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  );
}
