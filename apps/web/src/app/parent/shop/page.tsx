"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { catalogApi, cartApi, parentsApi, type Product, type ParentLink, type Category } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatKES } from "@schoolmart/shared";
import { Package } from "lucide-react";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/settings", label: "Settings" },
];

export default function ShopPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<ParentLink[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    parentsApi.children().then((res) => {
      const active = res.children.filter((c) => c.status === "ACTIVE");
      setChildren(active);
      if (active[0]) {
        setSchoolId(active[0].student.school.id);
        setStudentId(active[0].student.id);
      }
    }).catch(() => {});
    catalogApi.categories().then((res) => setCategories(res.categories)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!schoolId) return;
    catalogApi.search({ schoolId, q: q || undefined, categoryId: categoryId || undefined })
      .then((res) => setProducts(res.products))
      .catch(() => setProducts([]));
  }, [schoolId, q, categoryId]);

  const addToCart = async (productId: string) => {
    try {
      await cartApi.addItem({ productId, quantity: 1, schoolId, studentId });
      setMessage("Added to cart");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to add");
    }
  };

  if (loading || !user) return null;

  const schoolOptions = Array.from(
    new Map(
      children.map((c) => [c.student.school.id, { value: c.student.school.id, label: c.student.school.name }]),
    ).values(),
  );

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">Shop</h2>
          <p className="text-brand-muted">Browse school-approved meals, supplies, and care packages.</p>
        </div>
        <Button href="/parent/cart" variant="secondary">View Cart</Button>
      </div>

      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Select
          label="School"
          value={schoolId}
          onChange={(e) => {
            setSchoolId(e.target.value);
            const child = children.find((c) => c.student.school.id === e.target.value);
            if (child) setStudentId(child.student.id);
          }}
          options={[{ value: "", label: "Select school" }, ...schoolOptions]}
        />
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" />
        <Select
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>

      {!schoolId ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <Image src="/graphics/empty-shop.png" alt="" width={160} height={160} className="mb-4 rounded-2xl" />
          <p className="mb-4 text-brand-muted">Link an active child to shop for their school.</p>
          <Button href="/parent/children/link">Link a child</Button>
        </Card>
      ) : products.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <Image src="/graphics/empty-shop.png" alt="" width={160} height={160} className="mb-4 rounded-2xl" />
          <p className="text-brand-muted">No products available for this school yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden !p-0">
              <div className="flex h-36 items-center justify-center bg-brand-teal/5">
                <Package className="h-12 w-12 text-brand-teal/40" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">{p.category?.name ?? "Product"}</p>
                <h3 className="mt-1 font-semibold text-brand-ink">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-brand-muted">{p.description}</p>
                <p className="mt-2 text-xs text-brand-muted">{p.vendor?.name}</p>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <p className="font-bold text-brand-teal">{formatKES(p.priceMinor)}</p>
                  <Button onClick={() => addToCart(p.id)}>Add</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
