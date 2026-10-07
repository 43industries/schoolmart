"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { ordersApi, ApiError, type ParentOrder } from "@/lib/api";
import { orderBadgeClass, orderStatusLabel, TRACKING_STEPS, trackingStepIndex } from "@/lib/order-status";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKES } from "@schoolmart/shared";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/orders", label: "Orders" },
  { href: "/parent/wallet", label: "Wallet" },
  { href: "/parent/activities", label: "Funkies" },
  { href: "/parent/settings", label: "Settings" },
];

const CLOSED = new Set(["COLLECTED", "COMPLETED", "REFUNDED", "CANCELLED"]);

function TrackingBar({ status }: { status: string }) {
  const idx = trackingStepIndex(status);
  if (idx < 0) return null;
  return (
    <ol className="mt-4 grid grid-cols-5 gap-1">
      {TRACKING_STEPS.map((step, i) => (
        <li key={step.key} className="text-center">
          <div className={`h-1.5 rounded-full ${i <= idx ? "bg-brand-teal" : "bg-gray-200"}`} />
          <span className={`mt-1 block text-[11px] ${i <= idx ? "font-medium text-brand-ink" : "text-brand-muted"}`}>
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function ParentOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<ParentOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "PARENT")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const res = await ordersApi.mine();
    setOrders(res.orders);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setLoaded(true));
  }, [user, load]);

  const cancel = async (order: ParentOrder) => {
    const paid = order.status !== "PENDING_PAYMENT";
    const prompt = paid
      ? `Cancel ${order.orderNumber}? ${formatKES(order.totalMinor - order.refundedMinor)} will be refunded to ${order.student.firstName}'s wallet.`
      : `Cancel ${order.orderNumber}?`;
    if (!window.confirm(prompt)) return;
    setBusyId(order.id);
    setError("");
    setMessage("");
    try {
      const res = await ordersApi.cancelMine(order.id);
      setMessage(
        res.refundedMinor > 0
          ? `Order cancelled. ${formatKES(res.refundedMinor)} credited to ${order.student.firstName}'s wallet.`
          : "Order cancelled.",
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel order");
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !user) return null;

  const active = orders.filter((o) => !CLOSED.has(o.status));
  const past = orders.filter((o) => CLOSED.has(o.status));

  const renderOrder = (o: ParentOrder) => {
    const open = expanded === o.id;
    return (
      <Card key={o.id}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-brand-ink">{o.orderNumber}</span>
              <span className={orderBadgeClass(o.status)}>{orderStatusLabel(o.status)}</span>
            </div>
            <p className="text-sm text-brand-muted">
              For {o.student.firstName} {o.student.lastName} at {o.school.name} · {o.vendor?.name ?? "Vendor"}
            </p>
            <p className="text-xs text-brand-muted">Placed {new Date(o.createdAt).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-brand-teal">{formatKES(o.totalMinor)}</p>
            {o.refundedMinor > 0 && (
              <p className="text-xs text-green-700">{formatKES(o.refundedMinor)} refunded to wallet</p>
            )}
          </div>
        </div>

        <TrackingBar status={o.status} />

        {o.status === "READY_FOR_COLLECTION" && (
          <p className="mt-3 rounded-xl bg-brand-pink/10 px-3 py-2 text-sm text-brand-ink">
            Ready at the school desk. {o.student.firstName} collects using their student PIN.
          </p>
        )}
        {o.status === "DELIVERY_FAILED" && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            Delivery hit a problem. Our team is on it; contact support if you&apos;d rather cancel for a refund.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setExpanded(open ? null : o.id)}>
            {open ? "Hide details" : "Details"}
          </Button>
          {o.canCancel && (
            <Button variant="secondary" disabled={busyId === o.id} onClick={() => cancel(o)}>
              {busyId === o.id ? "Cancelling…" : "Cancel order"}
            </Button>
          )}
        </div>

        {open && (
          <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-brand-ink">Items</h4>
              <ul className="space-y-1 text-sm">
                {o.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>
                      {item.quantity} × {item.productName}
                    </span>
                    <span className="text-brand-muted">{formatKES(item.totalMinor)}</span>
                  </li>
                ))}
              </ul>
              {o.deliveryBatch && (
                <p className="mt-3 text-xs text-brand-muted">
                  Delivery run {o.deliveryBatch.batchNumber}
                  {o.deliveryBatch.pickedUpAt ? ` · picked up ${new Date(o.deliveryBatch.pickedUpAt).toLocaleString()}` : ""}
                  {o.deliveryBatch.deliveredAt
                    ? ` · handed to school ${new Date(o.deliveryBatch.deliveredAt).toLocaleString()}`
                    : ""}
                </p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-brand-ink">Timeline</h4>
              <ol className="space-y-2 text-sm">
                {o.statusHistory.map((h) => (
                  <li key={h.id} className="border-l-2 border-brand-teal/30 pl-3">
                    <p className="font-medium text-brand-ink">{orderStatusLabel(h.toStatus)}</p>
                    {h.note && <p className="text-xs text-brand-muted">{h.note}</p>}
                    <p className="text-xs text-brand-muted">{new Date(h.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Orders & tracking</h2>
        <p className="text-brand-muted">Follow each order from the vendor to the school desk.</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {loaded && orders.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No orders yet</CardTitle>
            <CardDescription>Orders you place for school delivery will be tracked here.</CardDescription>
          </CardHeader>
          <Button href="/parent/shop">Browse shop</Button>
        </Card>
      ) : (
        <>
          <section className="mb-8">
            <h3 className="mb-3 text-lg font-semibold text-brand-ink">Active ({active.length})</h3>
            {active.length === 0 ? (
              <Card>
                <p className="text-sm text-brand-muted">Nothing on the way right now.</p>
              </Card>
            ) : (
              <div className="space-y-3">{active.map(renderOrder)}</div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h3 className="mb-3 text-lg font-semibold text-brand-ink">Past orders</h3>
              <div className="space-y-3">{past.map(renderOrder)}</div>
            </section>
          )}
        </>
      )}
    </PortalLayout>
  );
}
