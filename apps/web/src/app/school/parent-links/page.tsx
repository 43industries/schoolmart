"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/catalog", label: "Catalog" },
  { href: "/school/settings", label: "Settings" },
];

interface PendingLink {
  id: string;
  relationship: string;
  createdAt: string;
  student: { firstName: string; lastName: string; studentNumber: string; grade: string };
  parentProfile: { user: { firstName: string; lastName: string; email: string | null; phoneE164: string | null } };
}

export default function ParentLinksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [fetching, setFetching] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const schoolId = user?.roles.find((r) => r.role === "SCHOOL_ADMIN")?.scopeId;

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const loadLinks = () => {
    if (!schoolId) return;
    schoolAdminApi.pendingLinks(schoolId)
      .then((res) => setLinks(res.links as PendingLink[]))
      .catch(() => {})
      .finally(() => setFetching(false));
  };

  useEffect(() => { loadLinks(); }, [schoolId]);

  const handleApprove = async (linkId: string) => {
    if (!schoolId) return;
    setProcessing(linkId);
    try {
      await schoolAdminApi.approveLink(schoolId, linkId);
      loadLinks();
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (linkId: string) => {
    if (!schoolId) return;
    setProcessing(linkId);
    try {
      await schoolAdminApi.rejectLink(schoolId, linkId, "Rejected by school admin");
      loadLinks();
    } finally {
      setProcessing(null);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Parent Link Requests</h2>
        <p className="text-brand-muted">Approve or reject parent-student link requests.</p>
      </div>

      {fetching ? (
        <p className="text-brand-muted">Loading...</p>
      ) : links.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <Image src="/graphics/empty-links.png" alt="" width={160} height={160} className="mb-4 rounded-2xl" />
          <p className="text-brand-muted">No pending link requests.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <Card key={link.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-brand-ink">
                    {link.parentProfile.user.firstName} {link.parentProfile.user.lastName}
                    <span className="ml-2 text-sm font-normal text-brand-muted capitalize">
                      ({link.relationship.toLowerCase()})
                    </span>
                  </p>
                  <p className="text-sm text-brand-muted">
                    Wants to link to: {link.student.firstName} {link.student.lastName} (#{link.student.studentNumber}, {link.student.grade})
                  </p>
                  <p className="text-xs text-brand-muted">
                    {link.parentProfile.user.email ?? link.parentProfile.user.phoneE164}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(link.id)}
                    disabled={processing === link.id}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleReject(link.id)}
                    disabled={processing === link.id}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
