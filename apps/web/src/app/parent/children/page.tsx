"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { parentsApi, parentRequestsApi, ApiError, type ParentLink } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type PendingRequest = {
  id: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string };
  product: { id: string; name: string; priceMinor: number; vendor: { name: string } };
};

export default function ChildrenPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<ParentLink[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const load = async () => {
    const [kids, reqs] = await Promise.all([parentsApi.children(), parentRequestsApi.list()]);
    setChildren(kids.children);
    setRequests(reqs.requests);
  };

  useEffect(() => {
    if (!user) return;
    load()
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  const review = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setBusyId(requestId);
    setError("");
    setMessage("");
    try {
      await parentRequestsApi.review({ requestId, action });
      setMessage(action === "APPROVE" ? "Added to your cart" : "Request rejected");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update request");
    } finally {
      setBusyId("");
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">My Children</h2>
          <p className="text-brand-muted">Manage linked children and campus product requests.</p>
        </div>
        <Button href="/parent/children/link">Link a Child</Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {requests.length > 0 && (
        <Card className="mb-8">
          <h3 className="mb-3 font-semibold text-brand-ink">Pending product requests</h3>
          <div className="space-y-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-brand-ink">
                    {r.student.firstName} wants {r.quantity}× {r.product.name}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {r.product.vendor.name} · {formatKES(r.product.priceMinor * r.quantity)}
                    {r.note ? ` · “${r.note}”` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" disabled={busyId === r.id} onClick={() => review(r.id, "APPROVE")}>
                    Add to cart
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyId === r.id}
                    onClick={() => review(r.id, "REJECT")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {fetching ? (
        <p className="text-brand-muted">Loading...</p>
      ) : children.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <Image src="/graphics/empty-links.png" alt="" width={160} height={160} className="mb-4 rounded-2xl" />
          <p className="mb-4 text-brand-muted">No children linked yet.</p>
          <Button href="/parent/children/link">Link Your First Child</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {children.map((link) => (
            <Card key={link.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-ink">
                  {link.student.firstName} {link.student.lastName}
                </p>
                <p className="text-sm text-brand-muted">
                  {link.student.school.name} · {link.student.grade} · Admission #{link.student.studentNumber}
                </p>
                {link.classTeacherName && (
                  <p className="text-xs text-brand-muted">Class teacher: {link.classTeacherName}</p>
                )}
                <p className="text-xs text-brand-muted capitalize">{link.relationship.toLowerCase()}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  link.status === "ACTIVE"
                    ? "bg-green-100 text-green-700"
                    : link.status === "PENDING_SCHOOL_APPROVAL"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {link.status.replace(/_/g, " ")}
              </span>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
