"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminApi } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { School, Users, FileText } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [schoolCount, setSchoolCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "SUPER_ADMIN" || r.role === "FINANCE")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    adminApi.schools().then((res) => setSchoolCount((res.schools as unknown[]).length)).catch(() => {});
  }, []);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={navItems}>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-ink">Platform Dashboard</h2>
        <p className="mt-1 text-brand-muted">Manage schools, users, and platform settings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: School, label: "Schools", value: schoolCount },
          { icon: Users, label: "Active Users", value: "—" },
          { icon: FileText, label: "Audit Events", value: "—" },
        ].map((stat) => (
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
