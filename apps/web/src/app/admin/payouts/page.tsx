"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { adminApi, ApiError } from "@/lib/api";
import { adminNavItems } from "@/lib/admin-nav";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKES } from "@schoolmart/shared";

type Payable = Awaited<ReturnType<typeof adminApi.openPayouts>>["payables"][number];

export default function AdminPayoutsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [totalOpenMinor, setTotalOpenMinor] = useState(0);
  const [recent, setRecent] = useState<
    Awaited<ReturnType<typeof adminApi.payouts>>["payouts"]
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [providerRef, setProviderRef] = useState("");
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
    const [open, hist] = await Promise.all([adminApi.openPayouts(), adminApi.payouts()]);
    setPayables(open.payables);
    setTotalOpenMinor(open.totalOpenMinor);
    setRecent(hist.payouts);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
  }, [user, load]);

  const selectedRows = useMemo(
    () => payables.filter((p) => selected.has(p.orderId)),
    [payables, selected],
  );

  const selectedVendorId = selectedRows[0]?.vendor?.id ?? null;
  const selectedTotal = selectedRows.reduce((s, p) => s + p.amountMinor, 0);
  const selectionValid =
    selectedRows.length > 0 &&
    selectedRows.every((p) => p.vendor?.id === selectedVendorId) &&
    !!selectedVendorId;

  const toggle = (orderId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleSettle = async () => {
    if (!selectionValid || !selectedVendorId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await adminApi.settlePayout({
        vendorId: selectedVendorId,
        orderIds: selectedRows.map((r) => r.orderId),
        notes: notes || undefined,
        providerRef: providerRef || undefined,
      });
      setMessage(`Settled ${formatKES(res.payout.amountMinor)} · payout ${res.payout.id.slice(0, 8)}`);
      setNotes("");
      setProviderRef("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Settlement failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Vendor payouts</h2>
        <p className="text-brand-muted">
          Open payables after parent payments. Record settlement once you have paid the vendor offline.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Open payables · {formatKES(totalOpenMinor)}</CardTitle>
          <CardDescription>Select orders for one vendor, then mark settled.</CardDescription>
        </CardHeader>
        {payables.length === 0 ? (
          <p className="text-sm text-brand-muted">No open vendor payables.</p>
        ) : (
          <div className="space-y-2">
            {payables.map((p) => (
              <label
                key={p.orderId}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 px-3 py-2"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(p.orderId)}
                  onChange={() => toggle(p.orderId)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-brand-ink">
                    {p.orderNumber ?? p.orderId.slice(0, 8)} · {formatKES(p.amountMinor)}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {p.vendor?.name ?? "Unknown vendor"}
                    {p.vendor?.payoutMpesaPhone ? ` · M-PESA ${p.vendor.payoutMpesaPhone}` : ""}
                    {p.vendor?.payoutAccountNumber
                      ? ` · ${p.vendor.payoutBankName ?? "Bank"} ${p.vendor.payoutAccountNumber}`
                      : !p.vendor?.payoutMpesaPhone
                        ? " · no payout destination"
                        : ""}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedRows.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            <p className="text-sm text-brand-ink">
              Selected {selectedRows.length} · {formatKES(selectedTotal)}
              {!selectionValid ? " — pick orders from a single vendor" : ""}
            </p>
            <Input
              label="Settlement reference (optional)"
              value={providerRef}
              onChange={(e) => setProviderRef(e.target.value)}
              placeholder="M-PESA receipt / bank ref"
            />
            <Input
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button type="button" disabled={busy || !selectionValid} onClick={handleSettle}>
              {busy ? "Recording…" : "Mark settled"}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent settlements</CardTitle>
          <CardDescription>Recorded payouts (MVP — manual / offline rails)</CardDescription>
        </CardHeader>
        {recent.length === 0 ? (
          <p className="text-sm text-brand-muted">No settlements yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-brand-ink">
                    {p.vendor.name} · {formatKES(p.amountMinor)}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {p.status} · {(Array.isArray(p.orderIds) ? p.orderIds.length : 0)} orders
                    {p.settledAt ? ` · ${new Date(p.settledAt).toLocaleString()}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PortalLayout>
  );
}
