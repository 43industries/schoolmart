"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi, ApiError, type Vendor } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKES } from "@schoolmart/shared";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/activities", label: "Funkies" },
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
    status?: string;
    vendor: { id: string; name: string };
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
  const [available, setAvailable] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<CatalogProductRow[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const schoolId = user?.roles.find((r) => r.role === "SCHOOL_ADMIN")?.scopeId;

  const load = async () => {
    if (!schoolId) return;
    const [v, a, p] = await Promise.all([
      schoolAdminApi.catalogVendors(schoolId),
      schoolAdminApi.availableVendors(schoolId),
      schoolAdminApi.catalogProducts(schoolId),
    ]);
    setVendors(v.vendors as CatalogVendorRow[]);
    setAvailable(a.vendors);
    setProducts(p.products as CatalogProductRow[]);
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!schoolId) return;
    load().catch(() => {});
  }, [schoolId]);

  const setVendorApproved = async (vendorId: string, approved: boolean) => {
    if (!schoolId) return;
    setError("");
    setBusyId(vendorId);
    try {
      await schoolAdminApi.approveVendor(schoolId, vendorId, approved);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusyId("");
    }
  };

  const setProductApproved = async (productId: string, approved: boolean) => {
    if (!schoolId) return;
    setError("");
    setBusyId(productId);
    try {
      await schoolAdminApi.approveProduct(schoolId, productId, approved);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusyId("");
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">School Catalog</h2>
        <p className="text-brand-muted">Approve vendors and products parents and students can order.</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <h3 className="mb-3 font-semibold text-brand-ink">Vendors</h3>
      <div className="mb-8 space-y-3">
        {vendors.map((row) => (
          <Card key={row.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium">{row.vendor.name}</p>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {row.approved ? "Approved" : "Pending"}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={busyId === row.vendor.id}
                onClick={() => setVendorApproved(row.vendor.id, !row.approved)}
              >
                {row.approved ? "Revoke" : "Approve"}
              </Button>
            </div>
          </Card>
        ))}
        {vendors.length === 0 && <p className="text-sm text-brand-muted">No vendors linked yet.</p>}
      </div>

      {available.length > 0 && (
        <>
          <h3 className="mb-3 font-semibold text-brand-ink">Available platform vendors</h3>
          <div className="mb-8 space-y-3">
            {available.map((v) => (
              <Card key={v.id} className="flex items-center justify-between gap-3">
                <p className="font-medium">{v.name}</p>
                <Button
                  type="button"
                  disabled={busyId === v.id}
                  onClick={() => setVendorApproved(v.id, true)}
                >
                  Add &amp; approve
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      <h3 className="mb-3 font-semibold text-brand-ink">Products</h3>
      <div className="space-y-3">
        {products.map((row) => (
          <Card key={row.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{row.product.name}</p>
              <p className="text-sm text-brand-muted">{row.product.vendor.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-brand-teal">{formatKES(row.product.priceMinor)}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {row.approved ? "Approved" : "Pending"}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={busyId === row.product.id}
                onClick={() => setProductApproved(row.product.id, !row.approved)}
              >
                {row.approved ? "Revoke" : "Approve"}
              </Button>
            </div>
          </Card>
        ))}
        {products.length === 0 && <p className="text-sm text-brand-muted">No products linked yet.</p>}
      </div>
    </PortalLayout>
  );
}
