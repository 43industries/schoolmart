"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/vendor", label: "Dashboard" },
];

export default function VendorDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "VENDOR")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Vendor Portal" navItems={navItems}>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-ink">Welcome, {user.firstName}</h2>
        <p className="mt-1 text-brand-muted">
          Vendors aggregate and deliver. Parents order, pay and track. Students collect securely.
        </p>
      </div>
      <Card>
        <h3 className="font-semibold text-brand-ink">Catalog &amp; fulfilment</h3>
        <p className="mt-2 text-sm text-brand-muted">
          Product management and order fulfilment tools expand in upcoming releases. If your application is still
          pending, an admin must approve your vendor before you go live.
        </p>
        <div className="mt-6">
          <Button href="/vendors">View vendors homepage</Button>
        </div>
      </Card>
    </PortalLayout>
  );
}
