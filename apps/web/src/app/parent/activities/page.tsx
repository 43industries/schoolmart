"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { activitiesApi, ApiError, type ParentActivitiesResponse } from "@/lib/api";
import { formatKES } from "@schoolmart/shared";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/wallet", label: "Wallet" },
  { href: "/parent/activities", label: "Funkies" },
  { href: "/parent/settings", label: "Settings" },
];

export default function ParentActivitiesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ParentActivitiesResponse | null>(null);
  const [childByActivity, setChildByActivity] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await activitiesApi.listForParent();
    setData(res);
    const defaults: Record<string, string> = {};
    for (const a of res.activities) {
      const child = res.children.find((c) => c.schoolId === a.school.id);
      if (child) defaults[a.id] = child.id;
    }
    setChildByActivity((prev) => ({ ...defaults, ...prev }));
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "PARENT")) router.push("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) load().catch(() => {});
  }, [user]);

  const handleRegister = async (activityId: string) => {
    const studentId = childByActivity[activityId];
    if (!studentId) {
      setError("Select a child for this activity");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const reg = await activitiesApi.register({ activityId, studentId });
      setMessage(
        reg.status === "CONFIRMED"
          ? "Registered and confirmed"
          : "Registered — confirm & pay to finalize",
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (registrationId: string) => {
    setBusy(true);
    setError("");
    try {
      await activitiesApi.confirm({ registrationId });
      setMessage("Payment confirmed (mock) — registration active");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">School funkies</h2>
        <p className="text-brand-muted">Register your children for campus activities and confirm fees.</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {!data || data.activities.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No published activities</CardTitle>
            <CardDescription>
              When your child&apos;s school publishes funkies or events, they will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.activities.map((activity) => {
            const schoolChildren = data.children.filter((c) => c.schoolId === activity.school.id);
            const myRegs = activity.myRegistrations;
            return (
              <Card key={activity.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-brand-ink">{activity.title}</p>
                    <p className="text-sm text-brand-muted">
                      {activity.school.name} · {activity.category} · {formatKES(activity.feeMinor)}
                    </p>
                    <p className="text-xs text-brand-muted">
                      {new Date(activity.startsAt).toLocaleString()}
                      {activity.location ? ` · ${activity.location}` : ""}
                      {activity.capacity ? ` · ${activity.registrationCount}/${activity.capacity} spots` : ` · ${activity.registrationCount} registered`}
                    </p>
                    {activity.description && (
                      <p className="mt-2 text-sm text-brand-muted">{activity.description}</p>
                    )}
                    {myRegs.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-brand-muted">
                        {myRegs.map((r) => {
                          const child = data.children.find((c) => c.id === r.studentId);
                          return (
                            <li key={r.id} className="flex items-center gap-2">
                              <span>
                                {child ? `${child.firstName} ${child.lastName}` : "Child"}: {r.status.replace(/_/g, " ")}
                              </span>
                              {r.status === "PENDING_PARENT" && (
                                <Button type="button" disabled={busy} onClick={() => handleConfirm(r.id)}>
                                  Confirm & pay
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="min-w-[220px] space-y-2">
                    <Select
                      label="Child"
                      value={childByActivity[activity.id] ?? ""}
                      onChange={(e) =>
                        setChildByActivity({ ...childByActivity, [activity.id]: e.target.value })
                      }
                      options={[
                        { value: "", label: "Select child" },
                        ...schoolChildren.map((c) => ({
                          value: c.id,
                          label: `${c.firstName} ${c.lastName}`,
                        })),
                      ]}
                    />
                    <Button type="button" disabled={busy || schoolChildren.length === 0} onClick={() => handleRegister(activity.id)}>
                      Register
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
