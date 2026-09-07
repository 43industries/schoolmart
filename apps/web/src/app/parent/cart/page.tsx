"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { cartApi, type CartResponse } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKES } from "@schoolmart/shared";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/settings", label: "Settings" },
];

export default function CartPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const load = () => {
    cartApi.get().then(setCart).catch(() => setCart(null));
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">Cart</h2>
          <p className="text-brand-muted">Review items before checkout (payments in Phase 3).</p>
        </div>
        <Button href="/parent/shop" variant="secondary">Continue shopping</Button>
      </div>

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
          <Card className="flex items-center justify-between">
            <p className="font-semibold">Subtotal</p>
            <p className="text-xl font-bold text-brand-teal">{formatKES(cart.subtotalMinor)}</p>
          </Card>
          <p className="text-sm text-brand-muted">Checkout and M-PESA payments arrive in Phase 3.</p>
        </div>
      )}
    </PortalLayout>
  );
}
