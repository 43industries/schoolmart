"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi, ApiError } from "@/lib/api";
import { formatKES, toMinorUnits, ACTIVITY_CATEGORIES } from "@schoolmart/shared";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/activities", label: "Funkies" },
  { href: "/school/catalog", label: "Catalog" },
  { href: "/school/settings", label: "Settings" },
];

interface Activity {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  location?: string | null;
  startsAt: string;
  feeMinor: number;
  capacity?: number | null;
  status: string;
  _count?: { registrations: number };
}

export default function SchoolActivitiesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const schoolId = user?.roles.find((r) => r.role === "SCHOOL_ADMIN")?.scopeId;
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "FUNKIES",
    location: "",
    startsAt: "",
    feeKes: "0",
    capacity: "",
    status: "PUBLISHED",
  });

  const load = () => {
    if (!schoolId) return;
    schoolAdminApi.activities(schoolId).then((res) => setActivities(res.activities as Activity[])).catch(() => {});
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    load();
  }, [schoolId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    setError("");
    setBusy(true);
    try {
      await schoolAdminApi.createActivity(schoolId, {
        title: form.title,
        description: form.description || undefined,
        category: form.category,
        location: form.location || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        feeMinor: toMinorUnits(Number(form.feeKes) || 0),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        status: form.status,
      });
      setForm({
        title: "",
        description: "",
        category: "FUNKIES",
        location: "",
        startsAt: "",
        feeKes: "0",
        capacity: "",
        status: "PUBLISHED",
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create activity");
    } finally {
      setBusy(false);
    }
  };

  const publish = async (activityId: string, status: string) => {
    if (!schoolId) return;
    setBusy(true);
    try {
      await schoolAdminApi.updateActivity(schoolId, activityId, { status });
      load();
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Funkies & activities</h2>
        <p className="text-brand-muted">Create school activities parents can register and fund.</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create activity</CardTitle>
            <CardDescription>Publish a funky, trip, club, or sports event</CardDescription>
          </CardHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={ACTIVITY_CATEGORIES.map((c) => ({ value: c, label: c.toLowerCase() }))}
            />
            <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input
              label="Starts at"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
            <Input label="Fee (KES)" type="number" min={0} value={form.feeKes} onChange={(e) => setForm({ ...form, feeKes: e.target.value })} />
            <Input label="Capacity (optional)" type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: "DRAFT", label: "Draft" },
                { value: "PUBLISHED", label: "Published" },
              ]}
            />
            <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Create activity"}</Button>
          </form>
        </Card>

        <div className="space-y-3">
          {activities.length === 0 ? (
            <Card>
              <p className="text-sm text-brand-muted">No activities yet.</p>
            </Card>
          ) : (
            activities.map((a) => (
              <Card key={a.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-brand-ink">{a.title}</p>
                    <p className="text-sm text-brand-muted">
                      {a.category} · {formatKES(a.feeMinor)} · {new Date(a.startsAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-brand-muted">
                      {a._count?.registrations ?? 0} registrations · {a.status}
                      {a.location ? ` · ${a.location}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {a.status !== "PUBLISHED" && (
                      <Button type="button" disabled={busy} onClick={() => publish(a.id, "PUBLISHED")}>Publish</Button>
                    )}
                    {a.status === "PUBLISHED" && (
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => publish(a.id, "CLOSED")}>Close</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
