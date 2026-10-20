"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminApi, type Vendor } from "@/lib/api";
import { adminNavItems } from "@/lib/admin-nav";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";

export default function AdminVendorsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    adminApi.vendors().then((res) => setVendors(res.vendors)).catch(() => {});
  }, []);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Vendors</h2>
        <p className="text-brand-muted">{vendors.length} marketplace vendors</p>
      </div>
      <div className="space-y-3">
        {vendors.map((v) => (
          <Card key={v.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-brand-ink">{v.name}</p>
              <p className="text-sm text-brand-muted">{v._count?.products ?? 0} products</p>
              {v.contactPersonName && (
                <p className="text-sm text-brand-muted">
                  Contact: {v.contactPersonName} · {v.contactPersonPhone ?? v.contactPhone ?? "—"}
                </p>
              )}
              <p className="text-sm text-brand-muted">
                Business email: {v.contactEmail ?? "—"}
                {v.websiteUrl ? (
                  <>
                    {" · "}
                    <a href={v.websiteUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-teal hover:underline">
                      Website
                    </a>
                  </>
                ) : null}
                {v.town ? ` · ${v.town}${v.county ? `, ${v.county}` : ""}` : ""}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              v.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>{v.status}</span>          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}
