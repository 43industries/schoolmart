"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminApi } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/settings", label: "Settings" },
];

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  type: string;
  county: string;
  town: string;
  status: string;
  _count: { students: number };
}

export default function AdminSchoolsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolRecord[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    adminApi.schools().then((res) => setSchools(res.schools as SchoolRecord[])).catch(() => {});
  }, []);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Schools</h2>
        <p className="text-brand-muted">{schools.length} schools on platform</p>
      </div>

      <div className="space-y-4">
        {schools.map((school) => (
          <Card key={school.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-brand-ink">{school.name}</p>
              <p className="text-sm text-brand-muted">{school.town}, {school.county} · {school.type.replace(/_/g, " ")}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{school._count.students} students</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                school.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
              }`}>{school.status}</span>
            </div>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}
