"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { adminOpsApi, ApiError, type AdminOrder } from "@/lib/api";
import { adminNavItems } from "@/lib/admin-nav";
import { orderBadgeClass, orderStatusLabel } from "@/lib/order-status";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatKES, toMinorUnits } from "@schoolmart/shared";

const STATUS_FILTERS = [
  "",
  "PENDING_PAYMENT",
  "PAID",
  "VENDOR_ACCEPTED",
  "PREPARING",
  "READY_FOR_DISPATCH",
  "IN_TRANSIT",
  "RECEIVED_BY_SCHOOL",
  "READY_FOR_COLLECTION",
  "COLLECTED",
  "DELIVERY_FAILED",
  "REFUNDED",
  "CANCELLED",
];

const REFUNDABLE = new Set([
  "PAID",
  "GROUPED",
  "VENDOR_ACCEPTED",
  "PREPARING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "IN_TRANSIT",
  "RECEIVED_BY_SCHOOL",
  "READY_FOR_COLLECTION",
  "DELIVERY_FAILED",
  "REFUND_PENDING",
]);

export default function AdminOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [refundFor, setRefundFor] = useState<AdminOrder | null>(null);
  const [refundKes, setRefundKes] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "SUPER_ADMIN" || r.role === "FINANCE")) {
      router.push(getDashboardPath(getPrimaryRole(user)));
    }
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const res = await adminOpsApi.orders({ status: status || undefined, q: q || undefined });
    setOrders(res.orders);
  }, [status, q]);

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
  }, [user, load]);

  const submitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundFor) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const amountKes = refundKes.trim() ? Number(refundKes) : undefined;
      if (amountKes !== undefined && (!Number.isFinite(amountKes) || amountKes <= 0)) {
        setError("Enter a valid refund amount, or leave blank for the full remaining amount");
        return;
      }
      const res = await adminOpsApi.refund(refundFor.id, {
        amountMinor: amountKes !== undefined ? toMinorUnits(amountKes) : undefined,
        reason: refundReason.trim(),
      });
      setMessage(
        `${res.full ? "Full" : "Partial"} refund of ${formatKES(res.amountMinor)} credited to the child's wallet for ${refundFor.orderNumber}`,
      );
      setRefundFor(null);
      setRefundKes("");
      setRefundReason("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Orders & refunds</h2>
        <p className="text-brand-muted">
          Refunds are credited to the child&apos;s wallet and reverse the vendor payable by the same amount.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
          <Input label="Order number" placeholder="SM-…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_FILTERS.map((s) => ({ value: s, label: s ? orderStatusLabel(s) : "All statuses" }))}
          />
        </div>
      </Card>

      {refundFor && (
        <Card className="mb-6 border-brand-teal/30">
          <CardHeader>
            <CardTitle>Refund {refundFor.orderNumber}</CardTitle>
            <CardDescription>
              Order total {formatKES(refundFor.totalMinor)}. Leave the amount blank for a full refund of what remains.
            </CardDescription>
          </CardHeader>
          <form onSubmit={submitRefund} className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
            <Input
              label="Amount (KES)"
              type="number"
              min={1}
              value={refundKes}
              onChange={(e) => setRefundKes(e.target.value)}
              placeholder="Full"
            />
            <Input
              label="Reason (shown to parent)"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              required
              minLength={3}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || refundReason.trim().length < 3}>
                {busy ? "Refunding…" : "Refund"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setRefundFor(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {orders.length === 0 ? (
          <Card>
            <p className="text-sm text-brand-muted">No orders match.</p>
          </Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-brand-ink">{o.orderNumber}</span>
                  <span className={orderBadgeClass(o.status)}>{orderStatusLabel(o.status)}</span>
                </div>
                <p className="text-brand-muted">
                  {o.student.firstName} {o.student.lastName} · {o.school.name} · {o.vendor?.name ?? "—"}
                </p>
                <p className="text-xs text-brand-muted">
                  {o.payments.map((p) => `${p.method} ${p.status.toLowerCase()}`).join(", ") || "No payment"} ·{" "}
                  {new Date(o.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-brand-teal">{formatKES(o.totalMinor)}</span>
                {REFUNDABLE.has(o.status) && (
                  <Button variant="secondary" onClick={() => setRefundFor(o)}>
                    Refund
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </PortalLayout>
  );
}
