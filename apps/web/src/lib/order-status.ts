const LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_PROCESSING: "Payment processing",
  PAID: "Paid",
  GROUPED: "Grouped",
  VENDOR_ACCEPTED: "Accepted by vendor",
  PREPARING: "Preparing",
  READY_FOR_DISPATCH: "Packed · awaiting driver",
  DISPATCHED: "Driver assigned",
  IN_TRANSIT: "On the way to school",
  RECEIVED_BY_SCHOOL: "At school",
  READY_FOR_COLLECTION: "Ready to collect",
  COLLECTED: "Collected",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
  FAILED: "Failed",
  DELIVERY_FAILED: "Delivery failed",
};

export function orderStatusLabel(status: string) {
  return LABELS[status] ?? status.replace(/_/g, " ").toLowerCase();
}

export function orderStatusClass(status: string) {
  if (["COLLECTED", "COMPLETED"].includes(status)) return "bg-green-100 text-green-700";
  if (["CANCELLED", "REFUNDED", "FAILED", "DELIVERY_FAILED"].includes(status)) return "bg-red-100 text-red-700";
  if (["PENDING_PAYMENT", "PAYMENT_PROCESSING", "REFUND_PENDING"].includes(status)) return "bg-amber-100 text-amber-700";
  if (status === "READY_FOR_COLLECTION") return "bg-brand-pink/15 text-brand-pink";
  return "bg-brand-teal/10 text-brand-teal";
}

/** Customer-facing journey steps used for the tracking bar. */
export const TRACKING_STEPS = [
  { key: "PAID", label: "Paid" },
  { key: "PREPARING", label: "Vendor preparing" },
  { key: "IN_TRANSIT", label: "On the way" },
  { key: "RECEIVED_BY_SCHOOL", label: "At school" },
  { key: "COLLECTED", label: "Collected" },
] as const;

const STEP_INDEX: Record<string, number> = {
  PAID: 0,
  GROUPED: 0,
  VENDOR_ACCEPTED: 1,
  PREPARING: 1,
  READY_FOR_DISPATCH: 1,
  DISPATCHED: 2,
  IN_TRANSIT: 2,
  RECEIVED_BY_SCHOOL: 3,
  READY_FOR_COLLECTION: 3,
  COLLECTED: 4,
  COMPLETED: 4,
};

/** -1 when the order is not on the happy path (unpaid, cancelled, refunded, failed). */
export function trackingStepIndex(status: string) {
  return STEP_INDEX[status] ?? -1;
}

export function orderBadgeClass(status: string) {
  return `w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${orderStatusClass(status)}`;
}
