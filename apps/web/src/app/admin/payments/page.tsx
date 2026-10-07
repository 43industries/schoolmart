"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { adminOpsApi, ApiError, type AdminPayment } from "@/lib/api";
import { adminNavItems } from "@/lib/admin-nav";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatKES } from "@schoolmart/shared";

const FILTERS = [
  { value: "", label: "All payments" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "review", label: "Needs review" },
];

function statusClass(status: string) {
  if (status === "SUCCEEDED") return "bg-green-100 text-green-700";
  if (status === "PROCESSING" || status === "PENDING") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function AdminPaymentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [filter, setFilter] = useState("");
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
    const res = await adminOpsApi.payments(
      filter === "review" ? { needsReview: true } : { status: filter || undefined },
    );
    setPayments(res.payments);
  }, [filter]);

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
  }, [user, load]);

  const reconcile = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const s = await adminOpsApi.reconcile();
      setMessage(
        `Checked ${s.checked} open payment(s): ${s.succeeded} succeeded, ${s.failed} failed or timed out, ${s.stillOpen} still waiting.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reconciliation failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">Payments & reconciliation</h2>
          <p className="text-brand-muted">
            Open M-PESA payments are re-checked with Safaricom every minute; this runs the same check now.
          </p>
        </div>
        <Button disabled={busy} onClick={reconcile}>
          {busy ? "Reconciling…" : "Reconcile now"}
        </Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <Card className="mb-6 max-w-xs">
        <Select label="Show" value={filter} onChange={(e) => setFilter(e.target.value)} options={FILTERS} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{payments.length} payment(s)</CardTitle>
          <CardDescription>Flagged payments (amount mismatch or reused receipt) need manual review.</CardDescription>
        </CardHeader>
        {payments.length === 0 ? (
          <p className="text-sm text-brand-muted">No payments match.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className={`flex flex-col gap-2 rounded-xl border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${
                  p.metadata?.needsReview ? "border-red-200 bg-red-50/50" : "border-gray-100"
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-brand-ink">
                      {p.purpose === "FUND_WALLET" ? "Wallet top-up" : `Order ${p.order?.orderNumber ?? ""}`}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(p.status)}`}>
                      {p.status.toLowerCase()}
                    </span>
                    {p.metadata?.needsReview && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">review</span>
                    )}
                  </div>
                  <p className="text-xs text-brand-muted">
                    {p.method} via {p.provider}
                    {p.phoneE164 ? ` · ${p.phoneE164}` : ""}
                    {p.metadata?.receipt ? ` · receipt ${p.metadata.receipt}` : ""}
                    {p.metadata?.completedVia ? ` · ${p.metadata.completedVia}` : ""} ·{" "}
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                  {(p.metadata?.reviewReason || p.metadata?.failureReason) && (
                    <p className="text-xs text-red-700">{p.metadata.reviewReason ?? p.metadata.failureReason}</p>
                  )}
                </div>
                <span className="font-bold text-brand-ink">{formatKES(p.amountMinor)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PortalLayout>
  );
}
