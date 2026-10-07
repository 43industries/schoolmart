"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { adminOpsApi, ApiError, type AdminDeliveryPartner } from "@/lib/api";
import { adminNavItems } from "@/lib/admin-nav";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-700";
  if (status === "PENDING") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function AdminDeliveryPartnersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [partners, setPartners] = useState<AdminDeliveryPartner[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "SUPER_ADMIN")) {
      router.push(getDashboardPath(getPrimaryRole(user)));
    }
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const res = await adminOpsApi.deliveryPartners();
    setPartners(res.partners);
  }, []);

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
  }, [user, load]);

  const setStatus = async (id: string, status: "APPROVED" | "REJECTED" | "SUSPENDED") => {
    setBusyId(id);
    setError("");
    try {
      await adminOpsApi.setDeliveryPartnerStatus(id, status);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !user) return null;

  const pending = partners.filter((p) => p.status === "PENDING").length;

  return (
    <PortalLayout title="Super Admin" navItems={adminNavItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Delivery agents</h2>
        <p className="text-brand-muted">
          {partners.length} registered · {pending} awaiting approval. Only approved agents see the job board.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {partners.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No delivery agents yet</CardTitle>
            <CardDescription>Applications from /deliveries/register appear here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {partners.map((p) => (
            <Card key={p.id} className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-brand-ink">
                    {p.owner.firstName} {p.owner.lastName}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(p.status)}`}>
                    {p.status.toLowerCase()}
                  </span>
                </div>
                <p className="text-brand-muted">
                  {p.owner.phoneE164 ?? "—"} · {p.owner.email ?? "—"}
                </p>
                <p className="text-brand-muted">
                  Base {p.town}, {p.county} · {(p.vehicleTypes ?? []).join(", ")} · {p._count.batches} run(s)
                </p>
                <p className="text-xs text-brand-muted">Serves: {p.serviceTowns}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.status !== "APPROVED" && (
                  <Button disabled={busyId === p.id} onClick={() => setStatus(p.id, "APPROVED")}>
                    Approve
                  </Button>
                )}
                {p.status === "PENDING" && (
                  <Button variant="secondary" disabled={busyId === p.id} onClick={() => setStatus(p.id, "REJECTED")}>
                    Reject
                  </Button>
                )}
                {p.status === "APPROVED" && (
                  <Button variant="secondary" disabled={busyId === p.id} onClick={() => setStatus(p.id, "SUSPENDED")}>
                    Suspend
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
