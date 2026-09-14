"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { cartApi, parentsApi, ApiError, type CartResponse, type ParentLink } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatKES } from "@schoolmart/shared";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/wallet", label: "Wallet" },
  { href: "/parent/activities", label: "Funkies" },
  { href: "/parent/settings", label: "Settings" },
];

export default function CartPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [children, setChildren] = useState<ParentLink[]>([]);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const load = () => {
    cartApi.get().then(setCart).catch(() => setCart(null));
    parentsApi.children().then((res) => {
      const active = res.children.filter((c) => c.status === "ACTIVE");
      setChildren(active);
      if (!studentId && active[0]) setStudentId(active[0].student.id);
    }).catch(() => {});
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const selected = children.find((c) => c.student.id === studentId);
  const schoolId = selected?.student.school.id;

  const handleCheckout = async () => {
    if (!studentId || !schoolId) {
      setError("Select a child for this order");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await cartApi.checkout({ studentId, schoolId });
      if (result.status === "PAID" && result.order) {
        setMessage(`Paid from wallet · Order ${result.order.orderNumber}`);
        load();
      } else {
        setMessage(result.message ?? "Checkout needs your approval on the Wallet page");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">Cart</h2>
          <p className="text-brand-muted">Checkout pays from the selected child&apos;s wallet under your spending rules.</p>
        </div>
        <Button href="/parent/shop" variant="secondary">Continue shopping</Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {!cart || cart.items.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <Image src="/graphics/empty-shop.png" alt="" width={160} height={160} className="mb-4 rounded-2xl" />
          <p className="mb-4 text-brand-muted">Your cart is empty.</p>
          <Button href="/parent/shop">Browse shop</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {cart.items.map((item) => (
            <Card key={item.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-brand-ink">{item.product.name}</p>
                <p className="text-sm text-brand-muted">{item.product.vendor.name}</p>
                <p className="text-sm text-brand-muted">
                  {formatKES(item.product.priceMinor)} × {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-bold text-brand-teal">{formatKES(item.lineTotalMinor)}</p>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const updated = await cartApi.updateItem(item.id, item.quantity - 1);
                    setCart(updated);
                  }}
                >
                  −
                </Button>
                <span className="w-6 text-center font-medium">{item.quantity}</span>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const updated = await cartApi.updateItem(item.id, item.quantity + 1);
                    setCart(updated);
                  }}
                >
                  +
                </Button>
              </div>
            </Card>
          ))}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Subtotal</p>
              <p className="text-xl font-bold text-brand-teal">{formatKES(cart.subtotalMinor)}</p>
            </div>
            {children.length > 0 ? (
              <Select
                label="Pay from child wallet"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                options={children.map((c) => ({
                  value: c.student.id,
                  label: `${c.student.firstName} ${c.student.lastName} (${c.student.school.name})`,
                }))}
              />
            ) : (
              <p className="text-sm text-brand-muted">Link and get school approval for a child before checkout.</p>
            )}
            <Button type="button" disabled={busy || !studentId} onClick={handleCheckout}>
              {busy ? "Processing…" : "Checkout with wallet"}
            </Button>
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
