"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { adminOpsApi } from "@/lib/api";
import { adminNavItems } from "@/lib/admin-nav";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { School, Users, FileText, ShoppingBag, CreditCard, Package } from "lucide-react";

type Stats = Awaited<ReturnType<typeof adminOpsApi.stats>>;

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "SUPER_ADMIN" || r.role === "FINANCE")) {
      router.push(getDashboardPath(getPrimaryRole(user)));
    }
  }, [user, loading, router]);

  useEffect(() => {
    adminOpsApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

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

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-ink">Platform control tower</h2>
        <p className="mt-1 text-brand-muted">
          Live counts across schools, payments, and collection. Review flagged payments under Payments.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    </PortalLayout>
  );
}
