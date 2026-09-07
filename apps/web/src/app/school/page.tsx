"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Package, Clock } from "lucide-react";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/catalog", label: "Catalog" },
  { href: "/school/settings", label: "Settings" },
];

export default function SchoolDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);

  const schoolRole = user?.roles.find((r) => r.role === "SCHOOL_ADMIN" && r.scopeId);
  const schoolId = schoolRole?.scopeId;

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "SCHOOL_ADMIN")) router.push("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (schoolId) {
      schoolAdminApi.pendingLinks(schoolId).then((res) => setPendingCount((res.links as unknown[]).length)).catch(() => {});
      schoolAdminApi.students(schoolId).then((res) => setStudentCount((res.students as unknown[]).length)).catch(() => {});
    }
  }, [schoolId]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-ink">School Dashboard</h2>
        <p className="mt-1 text-brand-muted">Manage students, parent links, and deliveries.</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Users, label: "Students", value: studentCount },
          { icon: Clock, label: "Pending Parent Links", value: pendingCount },
          { icon: Package, label: "Active Orders", value: 0 },
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

      {pendingCount > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>{pendingCount} parent link request(s) awaiting your approval.</CardDescription>
          </CardHeader>
          <Button href="/school/parent-links">Review Requests</Button>
        </Card>
      )}
    </PortalLayout>
  );
}
