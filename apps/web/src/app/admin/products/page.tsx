"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminApi, type Product } from "@/lib/api";
import { adminNavItems } from "@/lib/admin-nav";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { formatKES } from "@schoolmart/shared";

export default function AdminProductsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    adminApi.products().then((res) => setProducts(res.products)).catch(() => {});
  }, []);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Products</h2>
        <p className="text-brand-muted">{products.length} catalog products</p>
      </div>
      <div className="space-y-3">
        {products.map((p) => (
          <Card key={p.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-brand-ink">{p.name}</p>
              <p className="text-sm text-brand-muted">
                {p.vendor?.name} · {p.category?.name ?? "Uncategorized"} · stock {p.inventory?.availableQty ?? 0}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-brand-teal">{formatKES(p.priceMinor)}</p>
              <p className="text-xs text-brand-muted">{p.status}</p>
            </div>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}
