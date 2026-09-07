"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={navItems}>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
        </CardHeader>
        <p className="text-sm text-brand-muted">
          Commission rates, feature flags, and platform configuration will be managed here.
        </p>
      </Card>
    </PortalLayout>
  );
}
