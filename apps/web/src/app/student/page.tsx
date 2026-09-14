"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import {
  studentsApi,
  catalogApi,
  ApiError,
  type StudentProfile,
  type StudentWallet,
  type StudentCollection,
  type Product,
} from "@/lib/api";
import { formatKES } from "@schoolmart/shared";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Wallet, Sparkles, ShoppingBag } from "lucide-react";

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

type StudentRequest = {
  id: string;
  quantity: number;
  note: string | null;
  status: string;
  createdAt: string;
  product: { id: string; name: string; priceMinor: number; vendor: { id: string; name: string } };
};

export default function StudentPortalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [wallet, setWallet] = useState<StudentWallet | null>(null);
  const [collections, setCollections] = useState<StudentCollection[]>([]);
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [pinByOrder, setPinByOrder] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "STUDENT")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const [me, w, c, a, r] = await Promise.all([
      studentsApi.me(),
      studentsApi.wallet(),
      studentsApi.collections(),
      studentsApi.activities(),
      studentsApi.requests(),
    ]);
    setProfile(me);
    setWallet(w);
    setCollections(c.collections);
    setActivities(a.activities);
    setRequests(r.requests);

    const shop = await catalogApi.search({ schoolId: me.school.id });
    setProducts(shop.products);
  }, []);

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
    const poll = setInterval(() => {
      studentsApi.wallet().then(setWallet).catch(() => {});
    }, 8000);
    return () => clearInterval(poll);
  }, [user, load]);

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

  const handleRequest = async (productId: string) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await studentsApi.createRequest({ productId, quantity: 1 });
      setMessage("Request sent to your parent");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterActivity = async (activityId: string) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const reg = await studentsApi.registerActivity(activityId);
      setMessage(
        reg.status === "CONFIRMED"
          ? "Registered for activity"
          : "Registered — waiting for parent confirmation (fee)",
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
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
          <p className="text-sm text-brand-muted">Wallet balance (updates every few seconds)</p>
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
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-brand-teal" />
            Campus shop
          </CardTitle>
          <CardDescription>
            Browse approved products and request items — your parent reviews and pays from your wallet.
          </CardDescription>
        </CardHeader>
        {products.length === 0 ? (
          <p className="text-sm text-brand-muted">No products available yet.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-brand-ink">{p.name}</p>
                  <p className="text-xs text-brand-muted">
                    {p.vendor?.name ?? "Vendor"} · {formatKES(p.priceMinor)}
                  </p>
                </div>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => handleRequest(p.id)}>
                  Request
                </Button>
              </div>
            ))}
          </div>
        )}
        {requests.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-brand-ink">Your requests</p>
            <ul className="space-y-1 text-xs text-brand-muted">
              {requests.slice(0, 8).map((r) => (
                <li key={r.id}>
                  {r.quantity}× {r.product.name} · {statusLabel(r.status)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {wallet && wallet.transactions.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Wallet activity</CardTitle>
            <CardDescription>Recent credits and spends (read-only)</CardDescription>
          </CardHeader>
          <div className="space-y-2">
            {wallet.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-brand-ink">{tx.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-brand-muted">
                    {tx.description ?? "—"} · {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className={`font-semibold ${tx.type.startsWith("CREDIT") ? "text-green-700" : "text-brand-ink"}`}>
                  {tx.type.startsWith("CREDIT") ? "+" : "-"}
                  {formatKES(tx.amountMinor)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Funkies & activities</CardTitle>
          <CardDescription>
            Free activities confirm instantly. Paid ones use your wallet when rules allow, otherwise wait for a parent.
          </CardDescription>
        </CardHeader>
        {activities.length === 0 ? (
          <p className="text-sm text-brand-muted">No published activities yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-brand-ink">{a.title}</p>
                  <p className="text-xs text-brand-muted">
                    {a.category} · {formatKES(a.feeMinor)} · {new Date(a.startsAt).toLocaleString()}
                    {a.registration ? ` · ${statusLabel(a.registration.status)}` : ""}
                  </p>
                </div>
                {!a.registration && (
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => handleRegisterActivity(a.id)}>
                    Register
                  </Button>
                )}
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
