"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { parentsApi, type ParentLink } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/settings", label: "Settings" },
];

export default function ChildrenPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<ParentLink[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      parentsApi.children()
        .then((res) => setChildren(res.children))
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [user]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">My Children</h2>
          <p className="text-brand-muted">Manage linked children and approval status.</p>
        </div>
        <Button href="/parent/children/link">Link a Child</Button>
      </div>

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
                  {link.student.school.name} · {link.student.grade} · #{link.student.studentNumber}
                </p>
                <p className="text-xs text-brand-muted capitalize">{link.relationship.toLowerCase()}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                link.status === "ACTIVE" ? "bg-green-100 text-green-700"
                : link.status === "PENDING_SCHOOL_APPROVAL" ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
              }`}>
                {link.status.replace(/_/g, " ")}
              </span>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
