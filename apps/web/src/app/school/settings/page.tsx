"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi, ApiError, type SchoolOpsSettings } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/deliveries", label: "Deliveries" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/activities", label: "Funkies" },
  { href: "/school/catalog", label: "Catalog" },
  { href: "/school/settings", label: "Settings" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type WindowDraft = {
  key: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  active: boolean;
};

export default function SchoolSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const schoolId = user?.roles.find((r) => r.role === "SCHOOL_ADMIN")?.scopeId;

  const [settings, setSettings] = useState<SchoolOpsSettings | null>(null);
  const [notes, setNotes] = useState("");
  const [pinRequired, setPinRequired] = useState(true);
  const [windows, setWindows] = useState<WindowDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const s = await schoolAdminApi.settings(schoolId);
    setSettings(s);
    setNotes(s.deliveryNotes ?? "");
    setPinRequired(s.collectionPinRequired);
    setWindows(
      s.windows.map((w) => ({
        key: w.id,
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        daysOfWeek: w.daysOfWeek,
        active: w.active,
      })),
    );
  }, [schoolId]);

  useEffect(() => {
    if (schoolId) load().catch(() => setError("Could not load settings"));
  }, [schoolId, load]);

  const saveProfile = async () => {
    if (!schoolId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const s = await schoolAdminApi.updateSettings(schoolId, {
        deliveryNotes: notes || null,
        collectionPinRequired: pinRequired,
      });
      setSettings(s);
      setMessage("School settings saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const saveWindows = async () => {
    if (!schoolId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const s = await schoolAdminApi.putDeliveryWindows(
        schoolId,
        windows.map((w) => ({
          name: w.name,
          startTime: w.startTime,
          endTime: w.endTime,
          daysOfWeek: w.daysOfWeek,
          active: w.active,
        })),
      );
      setSettings(s);
      setWindows(
        s.windows.map((w) => ({
          key: w.id,
          name: w.name,
          startTime: w.startTime,
          endTime: w.endTime,
          daysOfWeek: w.daysOfWeek,
          active: w.active,
        })),
      );
      setMessage("Delivery windows saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (key: string, day: number) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.key !== key) return w;
        const has = w.daysOfWeek.includes(day);
        return {
          ...w,
          daysOfWeek: has ? w.daysOfWeek.filter((d) => d !== day) : [...w.daysOfWeek, day].sort(),
        };
      }),
    );
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">School settings</h2>
        <p className="text-brand-muted">
          {settings?.name ?? "Collection point"} — delivery notes, PIN policy, and receiving hours.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <Card className="mb-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Collection policy</CardTitle>
          <CardDescription>Shown to staff at the desk and used when verifying students.</CardDescription>
        </CardHeader>
        <label className="mb-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={pinRequired}
            onChange={(e) => setPinRequired(e.target.checked)}
          />
          <span>
            <span className="font-medium text-brand-ink">Collection PIN required</span>
            <span className="block text-brand-muted">
              Students should have a PIN. Desk handover still accepts a valid QR when presented.
            </span>
          </span>
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium text-brand-ink">Delivery notes</span>
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Deliveries accepted Mon–Fri 8am–4pm at the admin block"
          />
        </label>
        <Button disabled={busy} onClick={saveProfile}>
          Save policy
        </Button>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Delivery windows</CardTitle>
          <CardDescription>When the school accepts incoming parcels.</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          {windows.map((w) => (
            <div key={w.key} className="rounded-xl border border-gray-100 p-3">
              <div className="mb-2 grid gap-2 sm:grid-cols-3">
                <Input
                  label="Name"
                  value={w.name}
                  onChange={(e) =>
                    setWindows((prev) => prev.map((x) => (x.key === w.key ? { ...x, name: e.target.value } : x)))
                  }
                />
                <Input
                  label="Start (HH:MM)"
                  value={w.startTime}
                  onChange={(e) =>
                    setWindows((prev) =>
                      prev.map((x) => (x.key === w.key ? { ...x, startTime: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  label="End (HH:MM)"
                  value={w.endTime}
                  onChange={(e) =>
                    setWindows((prev) =>
                      prev.map((x) => (x.key === w.key ? { ...x, endTime: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="mb-2 flex flex-wrap gap-2">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    className={`rounded-lg px-2 py-1 text-xs font-medium ${
                      w.daysOfWeek.includes(day) ? "bg-brand-teal text-white" : "bg-gray-100 text-brand-muted"
                    }`}
                    onClick={() => toggleDay(w.key, day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={w.active}
                    onChange={(e) =>
                      setWindows((prev) =>
                        prev.map((x) => (x.key === w.key ? { ...x, active: e.target.checked } : x)),
                      )
                    }
                  />
                  Active
                </label>
                <Button
                  variant="secondary"
                  onClick={() => setWindows((prev) => prev.filter((x) => x.key !== w.key))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setWindows((prev) => [
                ...prev,
                {
                  key: `new-${Date.now()}`,
                  name: "Weekday receiving",
                  startTime: "08:00",
                  endTime: "16:00",
                  daysOfWeek: [1, 2, 3, 4, 5],
                  active: true,
                },
              ])
            }
          >
            Add window
          </Button>
          <Button disabled={busy} onClick={saveWindows}>
            Save windows
          </Button>
        </div>
      </Card>
    </PortalLayout>
  );
}
