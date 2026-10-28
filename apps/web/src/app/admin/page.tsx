"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatKES } from "@schoolmart/shared";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { adminOpsApi } from "@/lib/api";
import { adminNavItems } from "@/lib/admin-nav";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { School, Users, FileText, ShoppingBag, CreditCard, Package } from "lucide-react";

type Stats = Awaited<ReturnType<typeof adminOpsApi.stats>>;
type Analytics = Awaited<ReturnType<typeof adminOpsApi.analytics>>;
type Range = "7d" | "30d";

const MIX_COLORS = ["#0d9488", "#0f766e", "#14b8a6", "#5eead4", "#99f6e4"];

function shortDate(isoDay: string) {
  const d = new Date(`${isoDay}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [range, setRange] = useState<Range>("30d");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "SUPER_ADMIN" || r.role === "FINANCE")) {
      router.push(getDashboardPath(getPrimaryRole(user)));
    }
  }, [user, loading, router]);

  useEffect(() => {
    adminOpsApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAnalyticsLoading(true);
    adminOpsApi
      .analytics(range)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch(() => {
        if (!cancelled) setAnalytics(null);
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading || !user) return null;

  const cards = [
    { icon: School, label: "Schools", value: stats?.schools ?? "—" },
    { icon: Users, label: "Active users", value: stats?.activeUsers ?? "—" },
    { icon: ShoppingBag, label: "Orders", value: stats?.orders ?? "—" },
    { icon: Package, label: "Ready to collect", value: stats?.readyForCollection ?? "—" },
    { icon: CreditCard, label: "Pending payments", value: stats?.pendingPayments ?? "—" },
    { icon: CreditCard, label: "Failed payments (24h)", value: stats?.failedPayments24h ?? "—" },
    { icon: CreditCard, label: "Payments needing review", value: stats?.paymentsNeedingReview ?? "—" },
    { icon: FileText, label: "Audit events", value: stats?.auditEvents ?? "—" },
  ];

  const dailyChart =
    analytics?.daily.map((d) => ({
      ...d,
      label: shortDate(d.date),
      gmvKes: d.gmvPaidMinor / 100,
    })) ?? [];
  const hasDailySignal = dailyChart.some(
    (d) => d.ordersCreated > 0 || d.gmvPaidMinor > 0 || d.paymentsSucceeded > 0,
  );
  const funnelMax = Math.max(1, ...(analytics?.funnel.map((f) => f.count) ?? [1]));
  const hasFunnel = (analytics?.funnel.some((f) => f.count > 0) ?? false);
  const hasMix = (analytics?.paymentMix.length ?? 0) > 0;

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-ink">Platform control tower</h2>
        <p className="mt-1 text-brand-muted">
          Live snapshot plus range trends for orders, payments, and collection. Review flagged payments under
          Payments.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat) => (
          <Card key={stat.label}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-teal/10">
              <stat.icon className="h-5 w-5 text-brand-teal" />
            </div>
            <p className="text-2xl font-bold text-brand-ink">{stat.value}</p>
            <p className="text-sm text-brand-muted">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-brand-ink">Analytics</h3>
          <p className="text-sm text-brand-muted">Orders and checkout payments in the selected window</p>
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
          {(["7d", "30d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r ? "bg-brand-teal text-white" : "text-brand-muted hover:text-brand-ink"
              }`}
            >
              {r === "7d" ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-brand-muted">GMV (paid+)</p>
          <p className="mt-1 text-2xl font-bold text-brand-ink">
            {analyticsLoading ? "…" : formatKES(analytics?.kpis.gmvPaidMinor ?? 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-brand-muted">Orders created</p>
          <p className="mt-1 text-2xl font-bold text-brand-ink">
            {analyticsLoading ? "…" : (analytics?.kpis.ordersCreated ?? 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-brand-muted">Payment success</p>
          <p className="mt-1 text-2xl font-bold text-brand-ink">
            {analyticsLoading
              ? "…"
              : analytics?.kpis.paymentSuccessRate == null
                ? "—"
                : `${analytics.kpis.paymentSuccessRate}%`}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-brand-muted">Collected / completed</p>
          <p className="mt-1 text-2xl font-bold text-brand-ink">
            {analyticsLoading ? "…" : (analytics?.kpis.collectedCount ?? 0)}
          </p>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="min-h-[280px]">
          <h4 className="mb-4 font-semibold text-brand-ink">Daily orders & GMV</h4>
          {!hasDailySignal && !analyticsLoading ? (
            <p className="py-16 text-center text-sm text-brand-muted">No order activity in this range yet.</p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="orders" tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                  <YAxis yAxisId="gmv" orientation="right" tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "gmvKes") return [formatKES(Math.round(Number(value) * 100)), "GMV"];
                      return [value, "Orders"];
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="orders"
                    type="monotone"
                    dataKey="ordersCreated"
                    name="Orders"
                    stroke="#0f766e"
                    fill="url(#gmvFill)"
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="gmv"
                    type="monotone"
                    dataKey="gmvKes"
                    name="GMV (KES)"
                    stroke="#14b8a6"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="min-h-[280px]">
          <h4 className="mb-4 font-semibold text-brand-ink">Order funnel</h4>
          {!hasFunnel && !analyticsLoading ? (
            <p className="py-16 text-center text-sm text-brand-muted">No orders created in this range.</p>
          ) : (
            <ul className="space-y-3">
              {(analytics?.funnel ?? []).map((stage) => (
                <li key={stage.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-brand-ink">{stage.label}</span>
                    <span className="font-medium text-brand-ink">{stage.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand-teal transition-all"
                      style={{ width: `${Math.max(2, (stage.count / funnelMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="min-h-[260px] lg:col-span-1">
          <h4 className="mb-4 font-semibold text-brand-ink">Payment mix</h4>
          {!hasMix && !analyticsLoading ? (
            <p className="py-12 text-center text-sm text-brand-muted">No successful checkout payments yet.</p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.paymentMix ?? []}
                    dataKey="count"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {(analytics?.paymentMix ?? []).map((entry, i) => (
                      <Cell key={entry.method} fill={MIX_COLORS[i % MIX_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => {
                      const amount = (props.payload as { amountMinor?: number })?.amountMinor ?? 0;
                      return [`${value} · ${formatKES(amount)}`, "Succeeded"];
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <h4 className="mb-4 font-semibold text-brand-ink">Top schools</h4>
          {(analytics?.topSchools.length ?? 0) === 0 && !analyticsLoading ? (
            <p className="py-8 text-center text-sm text-brand-muted">No school orders in range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-brand-muted">
                    <th className="pb-2 font-medium">School</th>
                    <th className="pb-2 font-medium">Orders</th>
                    <th className="pb-2 font-medium">GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.topSchools ?? []).map((s) => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-2 pr-2 text-brand-ink">{s.name}</td>
                      <td className="py-2">{s.orderCount}</td>
                      <td className="py-2 font-medium text-brand-teal">{formatKES(s.gmvMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <h4 className="mb-4 font-semibold text-brand-ink">Top vendors</h4>
          {(analytics?.topVendors.length ?? 0) === 0 && !analyticsLoading ? (
            <p className="py-8 text-center text-sm text-brand-muted">No vendor orders in range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-brand-muted">
                    <th className="pb-2 font-medium">Vendor</th>
                    <th className="pb-2 font-medium">Orders</th>
                    <th className="pb-2 font-medium">GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.topVendors ?? []).map((v) => (
                    <tr key={v.id} className="border-b border-gray-50">
                      <td className="py-2 pr-2 text-brand-ink">{v.name}</td>
                      <td className="py-2">{v.orderCount}</td>
                      <td className="py-2 font-medium text-brand-teal">{formatKES(v.gmvMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {hasMix ? (
        <Card className="mb-6">
          <h4 className="mb-4 font-semibold text-brand-ink">Payment volume by method</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.paymentMix ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="method" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                <Tooltip formatter={(value) => [value, "Count"]} />
                <Bar dataKey="count" name="Count" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}
    </PortalLayout>
  );
}
