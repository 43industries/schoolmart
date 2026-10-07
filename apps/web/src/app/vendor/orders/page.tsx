"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { ordersApi, ApiError, type VendorOrder } from "@/lib/api";
import { orderBadgeClass, orderStatusLabel } from "@/lib/order-status";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKES } from "@schoolmart/shared";

const navItems = [
  { href: "/vendor", label: "Catalog" },
  { href: "/vendor/orders", label: "Orders" },
  { href: "/vendor/payouts", label: "Payouts" },
];

const NEXT_ACTION: Record<string, { status: "VENDOR_ACCEPTED" | "PREPARING" | "READY_FOR_DISPATCH"; label: string }> = {
  PAID: { status: "VENDOR_ACCEPTED", label: "Accept order" },
  GROUPED: { status: "VENDOR_ACCEPTED", label: "Accept order" },
  VENDOR_ACCEPTED: { status: "PREPARING", label: "Start preparing" },
  PREPARING: { status: "READY_FOR_DISPATCH", label: "Mark packed for dispatch" },
};

export default function VendorOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"active" | "history">("active");
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "VENDOR")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const res = await ordersApi.vendor(view);
    setOrders(res.orders);
  }, [view]);

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
    const id = setInterval(() => load().catch(() => {}), 20_000);
    return () => clearInterval(id);
  }, [user, load]);

  const run = async (orderId: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(orderId);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (order: VendorOrder) => {
    const reason = window.prompt(`Why can't you fulfil ${order.orderNumber}? The parent is refunded to the child's wallet.`);
    if (!reason || reason.trim().length < 3) return;
    run(order.id, () => ordersApi.vendorReject(order.id, reason.trim()), `${order.orderNumber} rejected and refunded`);
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Vendor Portal" navItems={navItems}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">Orders</h2>
          <p className="text-brand-muted">
            Accept, prepare, and pack paid orders. Packed orders appear on the delivery agents&apos; job board.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "active" ? "primary" : "secondary"} onClick={() => setView("active")}>
            Active
          </Button>
          <Button variant={view === "history" ? "primary" : "secondary"} onClick={() => setView("history")}>
            History
          </Button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {orders.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{view === "active" ? "No orders to fulfil" : "No past orders"}</CardTitle>
            <CardDescription>Paid orders for your products show up here automatically.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const next = NEXT_ACTION[o.status];
            const busy = busyId === o.id;
            return (
              <Card key={o.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-brand-ink">{o.orderNumber}</p>
                      <span className={orderBadgeClass(o.status)}>{orderStatusLabel(o.status)}</span>
                    </div>
                    <p className="mt-1 text-sm text-brand-muted">
                      {o.school.name}, {o.school.town} · {o.student.firstName} {o.student.lastName} (#
                      {o.student.studentNumber}, {o.student.grade})
                    </p>
                    <ul className="mt-2 space-y-0.5 text-sm text-brand-ink">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          {i.quantity} × {i.productName}
                        </li>
                      ))}
                    </ul>
                    {o.notes && <p className="mt-2 text-xs text-brand-muted">Note: {o.notes}</p>}
                    <p className="mt-2 text-xs text-brand-muted">Placed {new Date(o.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                    <p className="text-lg font-bold text-brand-teal">{formatKES(o.totalMinor)}</p>
                    {view === "active" && (
                      <div className="flex flex-wrap gap-2">
                        {next && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              run(o.id, () => ordersApi.vendorSetStatus(o.id, next.status), `${o.orderNumber} updated`)
                            }
                          >
                            {busy ? "Saving…" : next.label}
                          </Button>
                        )}
                        <Button variant="secondary" disabled={busy} onClick={() => handleReject(o)}>
                          Can&apos;t fulfil
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
