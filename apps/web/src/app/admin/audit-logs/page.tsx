"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminApi } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/settings", label: "Settings" },
];

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
  actor: { firstName: string; lastName: string; email: string | null } | null;
}

export default function AuditLogsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    adminApi.auditLogs().then((res) => setLogs(res.logs as AuditLog[])).catch(() => {});
  }, []);

  if (loading || !user) return null;

  return (
    <PortalLayout title="Super Admin" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Audit Logs</h2>
        <p className="text-brand-muted">Platform activity and security events.</p>
      </div>

      <div className="space-y-2">
        {logs.map((log) => (
          <Card key={log.id} className="py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-brand-ink">{log.action}</p>
                <p className="text-xs text-brand-muted">
                  {log.resourceType}{log.resourceId ? ` · ${log.resourceId.slice(0, 8)}...` : ""}
                </p>
                {log.actor && (
                  <p className="text-xs text-brand-muted">
                    by {log.actor.firstName} {log.actor.lastName}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-xs text-brand-muted">{formatDate(log.createdAt)}</p>
            </div>
          </Card>
        ))}
        {logs.length === 0 && <p className="text-brand-muted">No audit logs yet.</p>}
      </div>
    </PortalLayout>
  );
}
