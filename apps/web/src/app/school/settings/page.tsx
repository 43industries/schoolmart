"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/catalog", label: "Catalog" },
  { href: "/school/settings", label: "Settings" },
];

export default function SchoolSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>School Settings</CardTitle>
        </CardHeader>
        <p className="text-sm text-brand-muted">School profile and delivery settings will be configurable here in a future phase.</p>
      </Card>
    </PortalLayout>
  );
}
