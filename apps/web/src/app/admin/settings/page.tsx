"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminNavItems } from "@/lib/admin-nav";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
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
