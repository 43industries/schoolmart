"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import {
  ordersApi,
  schoolAdminApi,
  ApiError,
  type SchoolOrder,
  type SchoolDeliveryPartnerRow,
  type DeliveryPartnerSummary,
} from "@/lib/api";
import { orderBadgeClass, orderStatusLabel } from "@/lib/order-status";
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

type Board = Awaited<ReturnType<typeof ordersApi.school>>;

function studentLine(o: SchoolOrder) {
  return `${o.student.firstName} ${o.student.middleName ?? ""} ${o.student.lastName} · #${o.student.studentNumber} · ${o.student.grade}`;
}

function partnerLine(p: DeliveryPartnerSummary) {
  return `${p.owner.firstName} ${p.owner.lastName} · ${p.owner.phoneE164 ?? "no phone"} · ${p.primaryVehicleType ?? "vehicle"} ${p.vehiclePlateNumber ?? ""} · Base ${p.town}, ${p.county}`;
}

function timelineLabel(o: SchoolOrder) {
  if (o.status === "READY_FOR_DISPATCH") return o.deliveryBatch ? "Assigned — awaiting driver pickup" : "Vendor packed — awaiting delivery assignment";
  if (o.status === "DISPATCHED") return "Assigned — awaiting driver pickup";
  if (o.status === "IN_TRANSIT") return "Driver picked up — in transit";
  if (o.status === "RECEIVED_BY_SCHOOL") return "Delivered — received at school";
  if (o.status === "READY_FOR_COLLECTION") return "Ready for student collection";
  return o.status;
}

function SelectableList({
  orders,
  selected,
  onToggle,
  showDriver,
}: {
  orders: SchoolOrder[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  showDriver?: boolean;
}) {
  return (
    <div className="space-y-2">
      {orders.map((o) => {
        const driver = o.deliveryBatch?.deliveryPartner?.owner;
        return (
          <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 px-3 py-2">
            <input type="checkbox" className="mt-1" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-brand-ink">{o.orderNumber}</span>
                <span className={orderBadgeClass(o.status)}>{orderStatusLabel(o.status)}</span>
              </div>
              <p className="text-brand-muted">{studentLine(o)}</p>
              <p className="text-xs text-brand-muted">
                {o.vendor?.name ?? "Vendor"}
                {o.vendor?.contactPersonPhone || o.vendor?.contactPhone
                  ? ` (${o.vendor.contactPersonPhone ?? o.vendor.contactPhone})`
                  : ""}
                {o.items ? ` · ${o.items.reduce((s, i) => s + i.quantity, 0)} item(s)` : ""}
                {showDriver && driver
                  ? ` · Driver ${driver.firstName} ${driver.lastName}${driver.phoneE164 ? ` (${driver.phoneE164})` : ""} · ${o.deliveryBatch?.deliveryPartner?.primaryVehicleType ?? "vehicle"} ${o.deliveryBatch?.deliveryPartner?.vehiclePlateNumber ?? ""}`
                  : ""}
              </p>
              <p className="text-xs font-medium text-brand-teal">{timelineLabel(o)}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}

export default function SchoolDeliveriesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const schoolId = user?.roles.find((r) => r.role === "SCHOOL_ADMIN" && r.scopeId)?.scopeId;
  const [board, setBoard] = useState<Board | null>(null);
  const [incomingSel, setIncomingSel] = useState<Set<string>>(new Set());
  const [receivedSel, setReceivedSel] = useState<Set<string>>(new Set());
  const [pins, setPins] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [partners, setPartners] = useState<SchoolDeliveryPartnerRow[]>([]);
  const [availablePartners, setAvailablePartners] = useState<DeliveryPartnerSummary[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "SCHOOL_ADMIN")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const [res, linked, available] = await Promise.all([
      ordersApi.school(schoolId),
      schoolAdminApi.deliveryPartners(schoolId).catch(() => ({ partners: [] as SchoolDeliveryPartnerRow[] })),
      schoolAdminApi.availableDeliveryPartners(schoolId).catch(() => ({ partners: [] as DeliveryPartnerSummary[] })),
    ]);
    setBoard(res);
    setPartners(linked.partners);
    setAvailablePartners(available.partners);
  }, [schoolId]);

  useEffect(() => {
    load().catch(() => {});
    const id = setInterval(() => load().catch(() => {}), 20_000);
    return () => clearInterval(id);
  }, [load]);

  const toggle = (setter: typeof setIncomingSel) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  if (!schoolId) {
    return (
      <PortalLayout title="School Admin Portal" navItems={navItems}>
        <Card>
          <p className="text-sm text-brand-muted">Your account is not linked to a school yet.</p>
        </Card>
      </PortalLayout>
    );
  }

  const uncollected = board?.ready.filter((o) => o.uncollected) ?? [];
  const unassignedReady = board?.incoming.filter((o) => o.status === "READY_FOR_DISPATCH" && !o.deliveryBatch) ?? [];
  const approvedPartners = partners.filter((p) => p.approved);

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Deliveries & collection</h2>
        <p className="text-brand-muted">
          Receive parcels at the collection point, release them to students, and hand over with the student&apos;s PIN.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {uncollected.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>{uncollected.length} uncollected parcel(s)</CardTitle>
            <CardDescription>
              Waiting more than 3 days. Remind the students or contact the parents.
            </CardDescription>
          </CardHeader>
          <ul className="space-y-1 text-sm text-brand-ink">
            {uncollected.map((o) => (
              <li key={o.id}>
                {o.orderNumber} · {studentLine(o)} · since {new Date(o.updatedAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Delivery partners for this school</CardTitle>
          <CardDescription>
            Approve which platform-approved delivery agents may deliver here, then assign packed orders to them.
            Vendor → delivery agent → school handover is tracked below.
          </CardDescription>
        </CardHeader>
        {partners.length === 0 && availablePartners.length === 0 ? (
          <p className="text-sm text-brand-muted">No delivery partners available yet.</p>
        ) : (
          <div className="space-y-3">
            {partners.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium text-brand-ink">{partnerLine(row.deliveryPartner)}</p>
                  <p className="text-xs text-brand-muted">Serves: {row.deliveryPartner.serviceTowns}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {row.approved ? "Approved" : "Not approved"}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await schoolAdminApi.approveDeliveryPartner(schoolId, row.deliveryPartner.id, !row.approved);
                        return `${row.deliveryPartner.owner.firstName} ${row.approved ? "revoked" : "approved"} for this school`;
                      })
                    }
                  >
                    {row.approved ? "Revoke" : "Approve"}
                  </Button>
                  {row.approved && unassignedReady.length > 0 && (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const batch = await schoolAdminApi.assignDeliveryPartner(schoolId, row.deliveryPartner.id);
                          return `Assigned ${batch.orderCount} parcel(s) to ${row.deliveryPartner.owner.firstName} (${batch.batchNumber})`;
                        })
                      }
                    >
                      Assign {unassignedReady.length} ready parcel(s)
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {availablePartners.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-brand-ink">{partnerLine(p)}</p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await schoolAdminApi.approveDeliveryPartner(schoolId, p.id, true);
                      return `${p.owner.firstName} approved for this school`;
                    })
                  }
                >
                  Add &amp; approve
                </Button>
              </div>
            ))}
            {unassignedReady.length > 0 && approvedPartners.length === 0 && (
              <p className="text-sm text-amber-700">
                {unassignedReady.length} parcel(s) are packed by vendors and waiting — approve a delivery partner above to assign them.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incoming ({board?.incoming.length ?? 0})</CardTitle>
            <CardDescription>Packed by vendors or on the way. Tick what physically arrived.</CardDescription>
          </CardHeader>
          {board && board.incoming.length > 0 ? (
            <>
              <SelectableList orders={board.incoming} selected={incomingSel} onToggle={toggle(setIncomingSel)} showDriver />
              <Button
                className="mt-4"
                disabled={busy || incomingSel.size === 0}
                onClick={() =>
                  run(async () => {
                    const res = await ordersApi.schoolReceive(schoolId, [...incomingSel]);
                    setIncomingSel(new Set());
                    return `${res.moved.length} parcel(s) received`;
                  })
                }
              >
                Confirm received ({incomingSel.size})
              </Button>
            </>
          ) : (
            <p className="text-sm text-brand-muted">Nothing on the way right now.</p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Received at school ({board?.received.length ?? 0})</CardTitle>
            <CardDescription>Sorted and checked? Release to students so they get notified.</CardDescription>
          </CardHeader>
          {board && board.received.length > 0 ? (
            <>
              <SelectableList orders={board.received} selected={receivedSel} onToggle={toggle(setReceivedSel)} />
              <Button
                className="mt-4"
                disabled={busy || receivedSel.size === 0}
                onClick={() =>
                  run(async () => {
                    const res = await ordersApi.schoolReady(schoolId, [...receivedSel]);
                    setReceivedSel(new Set());
                    return `${res.moved.length} parcel(s) ready for collection`;
                  })
                }
              >
                Ready for collection ({receivedSel.size})
              </Button>
            </>
          ) : (
            <p className="text-sm text-brand-muted">No parcels waiting to be sorted.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ready for collection ({board?.ready.length ?? 0})</CardTitle>
          <CardDescription>
            Student enters their collection PIN at the desk, or confirms on their own phone.
          </CardDescription>
        </CardHeader>
        {board && board.ready.length > 0 ? (
          <div className="space-y-3">
            {board.ready.map((o) => (
              <div
                key={o.id}
                className={`flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-end sm:justify-between ${
                  o.uncollected ? "border-amber-200 bg-amber-50/50" : "border-gray-100"
                }`}
              >
                <div className="text-sm">
                  <p className="font-medium text-brand-ink">{o.orderNumber}</p>
                  <p className="text-brand-muted">{studentLine(o)}</p>
                  <p className="text-xs text-brand-muted">{o.vendor?.name}</p>
                </div>
                <div className="flex items-end gap-2">
                  <Input
                    label="Student PIN"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pins[o.id] ?? ""}
                    onChange={(e) => setPins({ ...pins, [o.id]: e.target.value })}
                  />
                  <Button
                    disabled={busy || (pins[o.id] ?? "").length < 4}
                    onClick={() =>
                      run(async () => {
                        await ordersApi.schoolHandover(schoolId, o.id, pins[o.id] ?? "");
                        setPins((prev) => ({ ...prev, [o.id]: "" }));
                        return `${o.orderNumber} handed over`;
                      })
                    }
                  >
                    Hand over
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-brand-muted">No parcels waiting for students.</p>
        )}
      </Card>

      {board && board.recentlyCollected.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recently collected</CardTitle>
            <CardDescription>Delivery history for the collection point</CardDescription>
          </CardHeader>
          <ul className="space-y-1 text-sm text-brand-muted">
            {board.recentlyCollected.map((o) => (
              <li key={o.id}>
                {o.orderNumber} · {o.student.firstName} {o.student.lastName} · {new Date(o.updatedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PortalLayout>
  );
}
