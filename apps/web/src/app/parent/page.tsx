"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { parentsApi, type ParentLink } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ShoppingBag, Wallet, Bell } from "lucide-react";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/settings", label: "Settings" },
];

export default function ParentDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<ParentLink[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "PARENT")) router.push("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      parentsApi.children().then((res) => setChildren(res.children)).catch(() => {});
    }
  }, [user]);

  if (loading || !user) return null;

  const activeChildren = children.filter((c) => c.status === "ACTIVE");
  const pendingChildren = children.filter((c) => c.status === "PENDING_SCHOOL_APPROVAL");

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-brand-ink">Welcome, {user.firstName}</h2>
        <p className="mt-1 text-brand-muted">Manage orders and support your children at school.</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, label: "Linked Children", value: activeChildren.length },
          { icon: ShoppingBag, label: "Active Orders", value: 0 },
          { icon: Wallet, label: "Wallet Balance", value: "—" },
          { icon: Bell, label: "Notifications", value: 0 },
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Children</CardTitle>
            <CardDescription>{activeChildren.length} active, {pendingChildren.length} pending</CardDescription>
          </CardHeader>
          {activeChildren.length === 0 && pendingChildren.length === 0 ? (
            <div className="py-6 text-center">
              <p className="mb-4 text-sm text-brand-muted">No children linked yet.</p>
              <Button href="/parent/children/link">Link a Child</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {[...activeChildren, ...pendingChildren].slice(0, 3).map((link) => (
                <div key={link.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-brand-surface p-3">
                  <div>
                    <p className="font-medium text-brand-ink">{link.student.firstName} {link.student.lastName}</p>
                    <p className="text-xs text-brand-muted">{link.student.school.name} · {link.student.grade}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${link.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {link.status === "ACTIVE" ? "Active" : "Pending"}
                  </span>
                </div>
              ))}
              <Link href="/parent/children" className="text-sm font-semibold text-brand-teal hover:underline">View all children →</Link>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump into the most common tasks</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-3">
            <Button href="/parent/shop">Browse shop</Button>
            <Button variant="secondary" href="/parent/children/link">Link a child</Button>
            <Button variant="secondary" href="/parent/cart">View cart</Button>
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}
