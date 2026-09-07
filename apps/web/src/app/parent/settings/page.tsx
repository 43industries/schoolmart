"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/settings", label: "Settings" },
];

export default function ParentSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <dl className="space-y-3 text-sm">
          <div><dt className="text-brand-muted">Name</dt><dd className="font-medium">{user.firstName} {user.lastName}</dd></div>
          <div><dt className="text-brand-muted">Email</dt><dd className="font-medium">{user.email ?? "—"}</dd></div>
          <div><dt className="text-brand-muted">Phone</dt><dd className="font-medium">{user.phone ?? "—"}</dd></div>
          <div><dt className="text-brand-muted">Status</dt><dd className="font-medium capitalize">{user.status.toLowerCase().replace(/_/g, " ")}</dd></div>
        </dl>
      </Card>
    </PortalLayout>
  );
}
