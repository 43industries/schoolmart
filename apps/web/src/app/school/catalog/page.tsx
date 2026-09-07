"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { formatKES } from "@schoolmart/shared";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/catalog", label: "Catalog" },
  { href: "/school/settings", label: "Settings" },
];

interface CatalogProductRow {
  id: string;
  approved: boolean;
  product: {
    id: string;
    name: string;
    priceMinor: number;
    vendor: { name: string };
  };
}

interface CatalogVendorRow {
  id: string;
  approved: boolean;
  vendor: { id: string; name: string; status: string };
}

export default function SchoolCatalogPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vendors, setVendors] = useState<CatalogVendorRow[]>([]);
  const [products, setProducts] = useState<CatalogProductRow[]>([]);
  const schoolId = user?.roles.find((r) => r.role === "SCHOOL_ADMIN")?.scopeId;

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!schoolId) return;
    schoolAdminApi.catalogVendors(schoolId).then((res) => setVendors(res.vendors as CatalogVendorRow[])).catch(() => {});
    schoolAdminApi.catalogProducts(schoolId).then((res) => setProducts(res.products as CatalogProductRow[])).catch(() => {});
  }, [schoolId]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">School Catalog</h2>
        <p className="text-brand-muted">Approved vendors and products available to parents.</p>
      </div>

      <h3 className="mb-3 font-semibold text-brand-ink">Vendors</h3>
      <div className="mb-8 space-y-3">
        {vendors.map((row) => (
          <Card key={row.id} className="flex items-center justify-between">
            <p className="font-medium">{row.vendor.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              row.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}>{row.approved ? "Approved" : "Pending"}</span>
          </Card>
        ))}
        {vendors.length === 0 && <p className="text-sm text-brand-muted">No vendors linked yet.</p>}
      </div>

      <h3 className="mb-3 font-semibold text-brand-ink">Products</h3>
      <div className="space-y-3">
        {products.map((row) => (
          <Card key={row.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{row.product.name}</p>
              <p className="text-sm text-brand-muted">{row.product.vendor.name}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-brand-teal">{formatKES(row.product.priceMinor)}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                row.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
              }`}>{row.approved ? "Approved" : "Pending"}</span>
            </div>
          </Card>
        ))}
        {products.length === 0 && <p className="text-sm text-brand-muted">No products linked yet.</p>}
      </div>
    </PortalLayout>
  );
}
