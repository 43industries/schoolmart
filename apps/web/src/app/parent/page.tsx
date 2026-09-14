"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { parentsApi, walletsApi, activitiesApi, type ParentLink } from "@/lib/api";
import { formatKES } from "@schoolmart/shared";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Package, Wallet, Sparkles, MapPin } from "lucide-react";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/wallet", label: "Wallet" },
  { href: "/parent/activities", label: "Funkies" },
  { href: "/parent/settings", label: "Settings" },
];

function statusLabel(status: string) {
  if (status === "ACTIVE") return "Active";
  if (status === "PENDING_SCHOOL_APPROVAL") return "Pending school approval";
  if (status === "REJECTED") return "Rejected";
  return status.replace(/_/g, " ");
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-green-100 text-green-700";
  if (status === "PENDING_SCHOOL_APPROVAL") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function ParentDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<ParentLink[]>([]);
  const [walletTotalMinor, setWalletTotalMinor] = useState<number | null>(null);
  const [activityCount, setActivityCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "PARENT")) router.push("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      parentsApi.children().then((res) => setChildren(res.children)).catch(() => {});
      walletsApi
        .list()
        .then((res) => {
          const total = res.wallets.reduce((sum, w) => sum + w.wallet.balanceMinor, 0);
          setWalletTotalMinor(total);
        })
        .catch(() => setWalletTotalMinor(null));
      activitiesApi
        .listForParent()
        .then((res) => setActivityCount(res.activities.length))
        .catch(() => setActivityCount(0));
    }
  }, [user]);

  if (loading || !user) return null;

  const activeChildren = children.filter((c) => c.status === "ACTIVE");
  const pendingChildren = children.filter((c) => c.status === "PENDING_SCHOOL_APPROVAL");

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-ink">Welcome, {user.firstName}</h2>
        <p className="mt-1 text-brand-muted">
          Track every delivery to school — children, orders, wallet, and activities in one place.
        </p>
      </div>

      {children.length === 0 && (
        <Card className="mb-8 border-brand-teal/20 bg-brand-teal/5">
          <CardHeader>
            <CardTitle>Link your first child</CardTitle>
            <CardDescription>
              Add school, admission number, and class teacher to start tracking deliveries.
            </CardDescription>
          </CardHeader>
          <Button href="/parent/children/link">Link a child</Button>
        </Card>
      )}

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-brand-ink">Children & link status</h3>
          <Button variant="secondary" href="/parent/children/link">Link another</Button>
        </div>
        {children.length === 0 ? (
          <Card>
            <p className="text-sm text-brand-muted">No children linked yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {children.map((link) => (
              <Card key={link.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-brand-ink">
                      {link.student.firstName} {link.student.lastName}
                      {link.claimedFirstName && (
                        <span className="ml-2 text-sm font-normal text-brand-muted">
                          (you entered: {link.claimedFirstName} {link.claimedLastName})
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-brand-muted">
                      {link.student.school.name} · Admission #{link.student.studentNumber}
                      {link.student.grade ? ` · ${link.student.grade}` : ""}
                    </p>
                    {link.classTeacherName && (
                      <p className="text-xs text-brand-muted">Class teacher: {link.classTeacherName}</p>
                    )}
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(link.status)}`}>
                    {statusLabel(link.status)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, label: "Active children", value: String(activeChildren.length) },
          { icon: Package, label: "Deliveries in transit", value: "0", hint: "Orders appear here once placed" },
          {
            icon: Wallet,
            label: "Wallet balance",
            value: walletTotalMinor === null ? "—" : formatKES(walletTotalMinor),
            hint: "Across approved children",
          },
          { icon: Sparkles, label: "School activities", value: String(activityCount), hint: "Open Funkies to register" },
        ].map((stat) => (
          <Card key={stat.label}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-teal/10">
              <stat.icon className="h-5 w-5 text-brand-teal" />
            </div>
            <p className="text-2xl font-bold text-brand-ink">{stat.value}</p>
            <p className="text-sm text-brand-muted">{stat.label}</p>
            {"hint" in stat && stat.hint && (
              <p className="mt-1 text-xs text-brand-muted/80">{stat.hint}</p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-teal" />
              Delivery tracking
            </CardTitle>
            <CardDescription>
              Live order status to campus collection will show here.
              {pendingChildren.length > 0
                ? ` ${pendingChildren.length} child link${pendingChildren.length > 1 ? "s" : ""} awaiting school approval.`
                : activeChildren.length === 0
                  ? " Link a child to unlock ordering and tracking."
                  : " Browse the shop to place your first delivery."}
            </CardDescription>
          </CardHeader>
          <div className="rounded-xl border border-dashed border-gray-200 bg-brand-surface px-4 py-8 text-center text-sm text-brand-muted">
            No active deliveries yet.
          </div>
          {activeChildren.length > 0 && (
            <div className="mt-4">
              <Button href="/parent/shop">Order for school delivery</Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Vendors deliver. You order, pay and track. Students collect.</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-3">
            {activeChildren.length > 0 ? (
              <Button href="/parent/shop">Browse shop</Button>
            ) : (
              <Button type="button" disabled>Browse shop</Button>
            )}
            <Button variant="secondary" href="/parent/activities">View funkies</Button>
            <Button variant="secondary" href="/parent/wallet">Manage wallets</Button>
            <Button variant="secondary" href="/parent/children/link">Link a child</Button>
            <Button variant="secondary" href="/parent/children">View children</Button>
            <Button variant="secondary" href="/parent/cart">View cart</Button>
          </div>
          <p className="mt-4 text-xs text-brand-muted">
            <Link href="/parent/children" className="font-semibold text-brand-teal hover:underline">
              Manage children →
            </Link>
          </p>
        </Card>
      </div>
    </PortalLayout>
  );
}
