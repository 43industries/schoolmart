"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { vendorApi, ApiError } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/vendor", label: "Catalog" },
  { href: "/vendor/orders", label: "Orders" },
  { href: "/vendor/payouts", label: "Payouts" },
];

export default function VendorPayoutsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    payoutMpesaPhone: "",
    payoutBankName: "",
    payoutAccountName: "",
    payoutAccountNumber: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "VENDOR")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    vendorApi
      .getPayout()
      .then((p) =>
        setForm({
          payoutMpesaPhone: p.payoutMpesaPhone ?? "",
          payoutBankName: p.payoutBankName ?? "",
          payoutAccountName: p.payoutAccountName ?? "",
          payoutAccountNumber: p.payoutAccountNumber ?? "",
        }),
      )
      .catch(() => {});
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await vendorApi.updatePayout({
        payoutMpesaPhone: form.payoutMpesaPhone || null,
        payoutBankName: form.payoutBankName || null,
        payoutAccountName: form.payoutAccountName || null,
        payoutAccountNumber: form.payoutAccountNumber || null,
      });
      setMessage("Payout destination saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save payout details");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Vendor Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Payout destination</h2>
        <p className="text-brand-muted">
          SchoolMart collects parent payments, then settles to your M-PESA or bank account.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Where should we pay you?</CardTitle>
          <CardDescription>Provide at least an M-PESA phone or bank account for admin settlement.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <Input
            label="M-PESA phone"
            type="tel"
            placeholder="0712345678"
            value={form.payoutMpesaPhone}
            onChange={(e) => setForm({ ...form, payoutMpesaPhone: e.target.value })}
          />
          <Input
            label="Bank name"
            value={form.payoutBankName}
            onChange={(e) => setForm({ ...form, payoutBankName: e.target.value })}
          />
          <Input
            label="Account name"
            value={form.payoutAccountName}
            onChange={(e) => setForm({ ...form, payoutAccountName: e.target.value })}
          />
          <Input
            label="Account number"
            value={form.payoutAccountNumber}
            onChange={(e) => setForm({ ...form, payoutAccountNumber: e.target.value })}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save payout details"}
          </Button>
        </form>
      </Card>
    </PortalLayout>
  );
}
