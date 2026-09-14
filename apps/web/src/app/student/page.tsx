"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { studentsApi, ApiError, type StudentProfile, type StudentWallet, type StudentCollection } from "@/lib/api";
import { formatKES } from "@schoolmart/shared";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Wallet, Sparkles } from "lucide-react";

const navItems = [
  { href: "/student", label: "Home" },
];

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

type StudentActivity = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  startsAt: string;
  feeMinor: number;
  registration: { id: string; status: string; paidMinor: number; confirmedAt: string | null } | null;
};

export default function StudentPortalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [wallet, setWallet] = useState<StudentWallet | null>(null);
  const [collections, setCollections] = useState<StudentCollection[]>([]);
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [pinByOrder, setPinByOrder] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "STUDENT")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  const load = async () => {
    const [me, w, c, a] = await Promise.all([
      studentsApi.me(),
      studentsApi.wallet(),
      studentsApi.collections(),
      studentsApi.activities(),
    ]);
    setProfile(me);
    setWallet(w);
    setCollections(c.collections);
    setActivities(a.activities);
  };

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
  }, [user]);

  const handleCollect = async (orderId: string) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const pin = pinByOrder[orderId];
      if (!pin) {
        setError("Enter your collection PIN");
        return;
      }
      await studentsApi.confirmCollection({ orderId, collectionPin: pin });
      setMessage("Package marked as collected");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Collection failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Student Portal" navItems={navItems}>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-ink">
          Hi{profile ? `, ${profile.preferredName ?? profile.firstName}` : ""}
        </h2>
        <p className="mt-1 text-brand-muted">
          {profile
            ? `${profile.school.name} · Admission #${profile.studentNumber} · ${profile.grade}`
            : "Loading your campus profile…"}
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-teal/10">
            <Wallet className="h-5 w-5 text-brand-teal" />
          </div>
          <p className="text-2xl font-bold text-brand-ink">
            {wallet ? formatKES(wallet.balanceMinor) : "—"}
          </p>
          <p className="text-sm text-brand-muted">Wallet balance (read-only)</p>
          {wallet && wallet.rules.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-brand-muted">
              {wallet.rules.map((r) => (
                <li key={r.id}>
                  {r.category.replace(/_/g, " ")} · {r.period.toLowerCase()} · limit {formatKES(r.limitMinor)}
                  {r.requiresApproval ? " · needs parent approval" : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-teal/10">
            <Package className="h-5 w-5 text-brand-teal" />
          </div>
          <p className="text-2xl font-bold text-brand-ink">
            {collections.filter((c) => c.canCollect).length}
          </p>
          <p className="text-sm text-brand-muted">Ready to collect</p>
        </Card>
        <Card>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-teal/10">
            <Sparkles className="h-5 w-5 text-brand-teal" />
          </div>
          <p className="text-2xl font-bold text-brand-ink">{activities.length}</p>
          <p className="text-sm text-brand-muted">School activities</p>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Funkies & activities</CardTitle>
          <CardDescription>Events published by your school. Parents register and confirm fees.</CardDescription>
        </CardHeader>
        {activities.length === 0 ? (
          <p className="text-sm text-brand-muted">No published activities yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
                <p className="font-medium text-brand-ink">{a.title}</p>
                <p className="text-xs text-brand-muted">
                  {a.category} · {formatKES(a.feeMinor)} · {new Date(a.startsAt).toLocaleString()}
                  {a.registration ? ` · ${statusLabel(a.registration.status)}` : " · not registered"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
          <CardDescription>
            Track deliveries to campus and confirm pickup with your collection PIN.
          </CardDescription>
        </CardHeader>
        {collections.length === 0 ? (
          <p className="text-sm text-brand-muted">No deliveries in progress yet.</p>
        ) : (
          <div className="space-y-4">
            {collections.map((order) => (
              <div key={order.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-brand-ink">{order.orderNumber}</p>
                    <p className="text-sm text-brand-muted">
                      {order.vendor?.name ?? "Vendor"} · {formatKES(order.totalMinor)} · {statusLabel(order.status)}
                    </p>
                    <ul className="mt-2 text-xs text-brand-muted">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.quantity}× {item.productName}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {order.canCollect && (
                    <div className="flex min-w-[200px] flex-col gap-2">
                      <Input
                        label="Collection PIN"
                        type="password"
                        inputMode="numeric"
                        value={pinByOrder[order.id] ?? ""}
                        onChange={(e) =>
                          setPinByOrder({ ...pinByOrder, [order.id]: e.target.value })
                        }
                      />
                      <Button type="button" disabled={busy} onClick={() => handleCollect(order.id)}>
                        Confirm collection
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PortalLayout>
  );
}
