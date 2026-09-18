"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { walletsApi, paymentsApi, ApiError, type ParentWalletSummary, type ParentWalletDetail } from "@/lib/api";
import { formatKES, toMinorUnits, WALLET_RULE_CATEGORIES, WALLET_RULE_PERIODS } from "@schoolmart/shared";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PendingPaymentConfirm } from "@/components/payments/pending-payment-confirm";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/wallet", label: "Wallet" },
  { href: "/parent/activities", label: "Funkies" },
  { href: "/parent/settings", label: "Settings" },
];

const categoryOptions = WALLET_RULE_CATEGORIES.map((c) => ({
  value: c,
  label: c === "ALL" ? "All spending" : c.replace(/_/g, " ").toLowerCase(),
}));

const periodOptions = WALLET_RULE_PERIODS.map((p) => ({
  value: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
}));

export default function ParentWalletPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [wallets, setWallets] = useState<ParentWalletSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<ParentWalletDetail | null>(null);
  const [fundAmount, setFundAmount] = useState("1000");
  const [fundPhone, setFundPhone] = useState("");
  const [fundMethod, setFundMethod] = useState<"MPESA" | "CARD" | "BANK" | "OTHER">("MPESA");
  const [pendingFund, setPendingFund] = useState<{ providerRef: string; hint: string } | null>(null);
  const [ruleForm, setRuleForm] = useState({
    category: "ALL",
    period: "WEEKLY",
    limitKes: "2000",
    requiresApproval: false,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [spendRequests, setSpendRequests] = useState<
    Array<{
      id: string;
      amountMinor: number;
      category: string;
      notes: string | null;
      createdAt: string;
      student: { id: string; firstName: string; lastName: string; studentNumber: string };
    }>
  >([]);

  const loadList = useCallback(async () => {
    const res = await walletsApi.list();
    setWallets(res.wallets);
    if (!selectedId && res.wallets[0]) {
      setSelectedId(res.wallets[0].studentId);
    }
  }, [selectedId]);

  const loadSpendRequests = useCallback(async () => {
    const res = await walletsApi.spendRequests();
    setSpendRequests(res.requests);
  }, []);

  const loadDetail = useCallback(async (studentId: string) => {
    if (!studentId) {
      setDetail(null);
      return;
    }
    const res = await walletsApi.get(studentId);
    setDetail(res);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "PARENT")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadList().catch(() => {});
    loadSpendRequests().catch(() => {});
  }, [user, loadList, loadSpendRequests]);

  useEffect(() => {
    if (!user || !selectedId) return;
    loadDetail(selectedId).catch(() => {});
    const poll = setInterval(() => {
      loadDetail(selectedId).catch(() => {});
      loadSpendRequests().catch(() => {});
    }, 8000);
    return () => clearInterval(poll);
  }, [user, selectedId, loadDetail, loadSpendRequests]);

  const handleReviewSpend = async (spendRequestId: string, action: "APPROVE" | "REJECT") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await walletsApi.reviewSpend({ spendRequestId, action });
      setMessage(action === "APPROVE" ? "Spend approved and paid from wallet" : "Spend rejected");
      await Promise.all([loadSpendRequests(), loadList(), selectedId ? loadDetail(selectedId) : Promise.resolve()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not review spend");
    } finally {
      setBusy(false);
    }
  };

  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError("");
    setMessage("");
    setBusy(true);
    setPendingFund(null);
    try {
      const amountKes = Number(fundAmount);
      if (!Number.isFinite(amountKes) || amountKes <= 0) {
        setError("Enter a valid amount");
        return;
      }
      if (fundMethod === "MPESA" && !fundPhone.trim()) {
        setError("Enter an M-PESA phone number");
        return;
      }
      const result = await walletsApi.fund({
        studentId: selectedId,
        amountMinor: toMinorUnits(amountKes),
        method: fundMethod,
        phone: fundPhone || undefined,
      });
      if (result.requiresConfirmation && result.payment.providerRef) {
        setPendingFund({
          providerRef: result.payment.providerRef,
          hint: result.instructions ?? "Confirm payment to credit the wallet.",
        });
        setMessage(`Payment ${result.payment.status.toLowerCase()} · ${result.payment.method}`);
      } else if (typeof result.balanceMinor === "number") {
        setMessage(`Funded successfully. New balance: ${formatKES(result.balanceMinor)}`);
        await Promise.all([loadList(), loadDetail(selectedId)]);
      } else {
        setMessage(result.instructions ?? "Funding initiated");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Funding failed");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmFund = async () => {
    if (!pendingFund || !selectedId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await paymentsApi.completeMock({
        providerRef: pendingFund.providerRef,
        status: "SUCCEEDED",
      });
      setPendingFund(null);
      setMessage(
        typeof result.balanceMinor === "number"
          ? `Wallet credited. New balance: ${formatKES(result.balanceMinor)}`
          : "Payment confirmed",
      );
      await Promise.all([loadList(), loadDetail(selectedId)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not confirm payment");
    } finally {
      setBusy(false);
    }
  };

  const handleRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const limitKes = Number(ruleForm.limitKes);
      if (!Number.isFinite(limitKes) || limitKes <= 0) {
        setError("Enter a valid limit");
        return;
      }
      await walletsApi.upsertRule({
        studentId: selectedId,
        category: ruleForm.category,
        period: ruleForm.period,
        limitMinor: toMinorUnits(limitKes),
        requiresApproval: ruleForm.requiresApproval,
      });
      setMessage("Spending rule saved");
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save rule");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setBusy(true);
    setError("");
    try {
      await walletsApi.deleteRule(ruleId);
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete rule");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Child wallets</h2>
        <p className="text-brand-muted">
          Parent-controlled funding and spending rules. Balance updates every few seconds.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {spendRequests.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pending spend approvals</CardTitle>
            <CardDescription>Checkouts waiting because a spending rule requires approval</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            {spendRequests.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-brand-ink">
                    {r.student.firstName} {r.student.lastName} · {formatKES(r.amountMinor)}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {r.category.replace(/_/g, " ")} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" disabled={busy} onClick={() => handleReviewSpend(r.id, "APPROVE")}>
                    Approve
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => handleReviewSpend(r.id, "REJECT")}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {wallets.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No wallets yet</CardTitle>
            <CardDescription>
              Funding rails (M-PESA, card, bank, and other) and spending rules appear here once a child is linked
              and the school has approved the link. Until then there is no wallet to load.
            </CardDescription>
          </CardHeader>
          <div className="space-y-3 text-sm text-brand-muted">
            <p>After approval you can:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Fund the child wallet from this page</li>
              <li>Set spending limits and approval rules</li>
              <li>Pay cart checkouts from wallet or pay the order directly</li>
            </ul>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button href="/parent/children/link">Link a child</Button>
            <Button href="/parent/children" variant="secondary">
              View my children
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Card className="h-fit space-y-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Children</p>
            {wallets.map((w) => (
              <button
                key={w.studentId}
                type="button"
                onClick={() => setSelectedId(w.studentId)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedId === w.studentId
                    ? "bg-brand-teal/10 font-semibold text-brand-ink"
                    : "hover:bg-brand-surface text-brand-muted"
                }`}
              >
                <span className="block text-brand-ink">
                  {w.student.firstName} {w.student.lastName}
                </span>
                <span className="block text-xs">{formatKES(w.wallet.balanceMinor)}</span>
              </button>
            ))}
          </Card>

          {detail && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {detail.student.firstName} {detail.student.lastName}
                  </CardTitle>
                  <CardDescription>
                    {detail.student.school.name} · Admission #{detail.student.studentNumber}
                  </CardDescription>
                </CardHeader>
                <p className="text-3xl font-bold text-brand-ink">{formatKES(detail.wallet.balanceMinor)}</p>
                <p className="mt-1 text-xs text-brand-muted">Live balance (updates every few seconds)</p>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Fund wallet</CardTitle>
                    <CardDescription>Top up via M-PESA, card, bank, or other (mock until live rails)</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleFund} className="space-y-3">
                    <Select
                      label="Payment method"
                      value={fundMethod}
                      onChange={(e) => setFundMethod(e.target.value as typeof fundMethod)}
                      options={[
                        { value: "MPESA", label: "M-PESA" },
                        { value: "CARD", label: "Card" },
                        { value: "BANK", label: "Bank transfer" },
                        { value: "OTHER", label: "Other" },
                      ]}
                    />
                    <Input
                      label="Amount (KES)"
                      type="number"
                      min={1}
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      required
                    />
                    {fundMethod === "MPESA" && (
                      <Input
                        label="M-PESA phone"
                        type="tel"
                        placeholder="0712345678"
                        value={fundPhone}
                        onChange={(e) => setFundPhone(e.target.value)}
                        required
                      />
                    )}
                    <Button type="submit" disabled={busy}>
                      {busy ? "Processing..." : "Start funding"}
                    </Button>
                  </form>
                  {pendingFund && (
                    <div className="mt-4">
                      <PendingPaymentConfirm
                        hint={pendingFund.hint}
                        busy={busy}
                        onConfirm={handleConfirmFund}
                      />
                    </div>
                  )}
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Spending rules</CardTitle>
                    <CardDescription>Parent-controlled limits by category and period</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleRule} className="space-y-3">
                    <Select
                      label="Category"
                      value={ruleForm.category}
                      onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                      options={categoryOptions}
                    />
                    <Select
                      label="Period"
                      value={ruleForm.period}
                      onChange={(e) => setRuleForm({ ...ruleForm, period: e.target.value })}
                      options={periodOptions}
                    />
                    <Input
                      label="Limit (KES)"
                      type="number"
                      min={1}
                      value={ruleForm.limitKes}
                      onChange={(e) => setRuleForm({ ...ruleForm, limitKes: e.target.value })}
                      required
                    />
                    <label className="flex items-center gap-2 text-sm text-brand-ink">
                      <input
                        type="checkbox"
                        checked={ruleForm.requiresApproval}
                        onChange={(e) => setRuleForm({ ...ruleForm, requiresApproval: e.target.checked })}
                      />
                      Require parent approval for spends in this rule
                    </label>
                    <Button type="submit" disabled={busy}>
                      Save rule
                    </Button>
                  </form>

                  {detail.wallet.rules.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                      {detail.wallet.rules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between rounded-xl bg-brand-surface px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium text-brand-ink">
                              {rule.category.replace(/_/g, " ")} · {rule.period.toLowerCase()}
                            </p>
                            <p className="text-xs text-brand-muted">
                              Limit {formatKES(rule.limitMinor)}
                              {rule.requiresApproval ? " · approval required" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 hover:underline"
                            onClick={() => handleDeleteRule(rule.id)}
                            disabled={busy}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Ledger</CardTitle>
                  <CardDescription>Recent wallet transactions</CardDescription>
                </CardHeader>
                {detail.wallet.transactions.length === 0 ? (
                  <p className="text-sm text-brand-muted">No transactions yet. Fund the wallet to get started.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.wallet.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-brand-ink">{tx.type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-brand-muted">
                            {tx.description ?? "—"} · {new Date(tx.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${tx.type.startsWith("CREDIT") ? "text-green-700" : "text-brand-ink"}`}>
                            {tx.type.startsWith("CREDIT") ? "+" : "-"}
                            {formatKES(tx.amountMinor)}
                          </p>
                          <p className="text-xs text-brand-muted">Bal {formatKES(tx.balanceAfterMinor)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  );
}
