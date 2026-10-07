"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { ordersApi, ApiError, type DriverBatch, type DriverJob } from "@/lib/api";
import { orderBadgeClass, orderStatusLabel } from "@/lib/order-status";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const navItems = [{ href: "/driver", label: "Jobs" }];

type Profile = Awaited<ReturnType<typeof ordersApi.driverMe>>;

const BATCH_LABEL: Record<string, string> = {
  PLANNED: "Accepted · collect from vendors",
  IN_PROGRESS: "Picked up · heading to school",
  DELIVERED: "Delivered",
  FAILED: "Failed / released",
  CANCELLED: "Cancelled",
};

function mapsLink(parts: Array<string | null | undefined>) {
  const q = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function DriverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [batches, setBatches] = useState<DriverBatch[]>([]);
  const [recipients, setRecipients] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "DRIVER")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const me = await ordersApi.driverMe();
    setProfile(me);
    if (me.status !== "APPROVED") return;
    const [j, b] = await Promise.all([ordersApi.driverJobs(), ordersApi.driverBatches()]);
    setJobs(j.jobs);
    setBatches(b.batches);
  }, []);

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
    const id = setInterval(() => load().catch(() => {}), 30_000);
    return () => clearInterval(id);
  }, [user, load]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setMessage(await action());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  const active = batches.filter((b) => b.status === "PLANNED" || b.status === "IN_PROGRESS");
  const past = batches.filter((b) => b.status !== "PLANNED" && b.status !== "IN_PROGRESS");

  return (
    <PortalLayout title="Delivery Agent" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Delivery jobs</h2>
        <p className="text-brand-muted">
          Accept a school run, collect packed parcels from vendors, and hand them over at the school collection point.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {profile && profile.status !== "APPROVED" ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Application {profile.status.toLowerCase()}</CardTitle>
            <CardDescription>
              {profile.status === "PENDING"
                ? "SchoolMart is reviewing your delivery partner application. Jobs appear here once approved."
                : "Your account cannot take jobs right now. Contact SchoolMart support."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>My active runs ({active.length})</CardTitle>
              <CardDescription>Confirm pickup once everything is loaded; record who received it at school.</CardDescription>
            </CardHeader>
            {active.length === 0 ? (
              <p className="text-sm text-brand-muted">No active runs. Accept a job below.</p>
            ) : (
              <div className="space-y-4">
                {active.map((b) => {
                  const vendors = new Map(b.orders.filter((o) => o.vendor).map((o) => [o.vendor!.id, o.vendor!]));
                  return (
                    <div key={b.id} className="rounded-2xl border border-gray-100 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-brand-ink">
                            {b.batchNumber} · {b.school.name}
                          </p>
                          <p className="text-sm text-brand-muted">
                            {BATCH_LABEL[b.status] ?? b.status} · {b.orders.length} parcel(s)
                          </p>
                        </div>
                        <a
                          href={mapsLink([b.school.name, b.school.addressLine, b.school.town, b.school.county, "Kenya"])}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-brand-teal hover:underline"
                        >
                          Route to school →
                        </a>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Pickups</p>
                          <ul className="mt-1 space-y-1 text-sm">
                            {[...vendors.values()].map((v) => (
                              <li key={v.id}>
                                <a
                                  href={mapsLink([v.name, v.addressLine, v.town, "Kenya"])}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-brand-ink hover:text-brand-teal"
                                >
                                  {v.name}
                                </a>
                                <span className="text-brand-muted">
                                  {v.town ? ` · ${v.town}` : ""}
                                  {v.contactPhone ? ` · ${v.contactPhone}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Parcels</p>
                          <ul className="mt-1 space-y-1 text-sm">
                            {b.orders.map((o) => (
                              <li key={o.id} className="flex flex-wrap items-center gap-2">
                                <span className="text-brand-ink">{o.orderNumber}</span>
                                <span className={orderBadgeClass(o.status)}>{orderStatusLabel(o.status)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-end gap-2">
                        {b.status === "PLANNED" && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await ordersApi.driverPickup(b.id);
                                return `${b.batchNumber} picked up`;
                              })
                            }
                          >
                            Confirm pickup
                          </Button>
                        )}
                        {b.status === "IN_PROGRESS" && (
                          <>
                            <Input
                              label="Received at school by"
                              placeholder="Name of school staff"
                              value={recipients[b.id] ?? ""}
                              onChange={(e) => setRecipients({ ...recipients, [b.id]: e.target.value })}
                            />
                            <Button
                              disabled={busy || (recipients[b.id] ?? "").trim().length < 2}
                              onClick={() =>
                                run(async () => {
                                  await ordersApi.driverDeliver(b.id, { recipientName: (recipients[b.id] ?? "").trim() });
                                  return `${b.batchNumber} delivered to ${b.school.name}`;
                                })
                              }
                            >
                              Confirm handover
                            </Button>
                          </>
                        )}
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            const reason = window.prompt(
                              b.status === "PLANNED"
                                ? "Why are you releasing this job? It goes back to the job board."
                                : "What went wrong? Parcels will be marked delivery failed.",
                            );
                            if (!reason || reason.trim().length < 3) return;
                            run(async () => {
                              await ordersApi.driverFail(b.id, reason.trim());
                              return b.status === "PLANNED" ? "Job released" : "Delivery marked failed";
                            });
                          }}
                        >
                          {b.status === "PLANNED" ? "Release job" : "Report problem"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Available jobs ({jobs.length})</CardTitle>
              <CardDescription>Packed parcels grouped by school. Accepting takes every waiting parcel for that school.</CardDescription>
            </CardHeader>
            {jobs.length === 0 ? (
              <p className="text-sm text-brand-muted">No parcels waiting. Check back soon.</p>
            ) : (
              <div className="space-y-3">
                {jobs.map((j) => (
                  <div
                    key={j.school.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm">
                      <p className="font-semibold text-brand-ink">
                        {j.school.name} · {j.school.town}, {j.school.county}
                      </p>
                      <p className="text-brand-muted">
                        {j.orderCount} parcel(s) · pick up from {j.pickups.map((p) => p.name).join(", ")}
                      </p>
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const res = await ordersApi.driverAccept(j.school.id);
                          return `Accepted ${res.batchNumber} (${res.orderCount} parcels)`;
                        })
                      }
                    >
                      Accept job
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>Completed and failed runs</CardDescription>
              </CardHeader>
              <ul className="space-y-1 text-sm text-brand-muted">
                {past.map((b) => (
                  <li key={b.id}>
                    {b.batchNumber} · {b.school.name} · {b.orders.length} parcel(s) · {BATCH_LABEL[b.status] ?? b.status}
                    {b.deliveredAt ? ` · ${new Date(b.deliveredAt).toLocaleString()}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </PortalLayout>
  );
}
