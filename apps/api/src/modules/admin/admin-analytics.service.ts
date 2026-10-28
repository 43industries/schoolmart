import {
  prisma,
  OrderStatus,
  PaymentPurpose,
  PaymentStatus,
} from "@schoolmart/db";

export type AnalyticsRange = "7d" | "30d";

const PAID_OR_LATER: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.GROUPED,
  OrderStatus.VENDOR_ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DISPATCH,
  OrderStatus.DISPATCHED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.RECEIVED_BY_SCHOOL,
  OrderStatus.READY_FOR_COLLECTION,
  OrderStatus.COLLECTED,
  OrderStatus.COMPLETED,
];

const FUNNEL_BUCKETS: Array<{ key: string; label: string; statuses: OrderStatus[] }> = [
  {
    key: "PENDING_PAYMENT",
    label: "Awaiting payment",
    statuses: [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_PROCESSING],
  },
  {
    key: "PAID",
    label: "Paid / preparing",
    statuses: [
      OrderStatus.PAID,
      OrderStatus.GROUPED,
      OrderStatus.VENDOR_ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_DISPATCH,
    ],
  },
  {
    key: "IN_TRANSIT",
    label: "In transit",
    statuses: [OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT],
  },
  {
    key: "AT_SCHOOL",
    label: "At school",
    statuses: [OrderStatus.RECEIVED_BY_SCHOOL, OrderStatus.READY_FOR_COLLECTION],
  },
  {
    key: "COLLECTED",
    label: "Collected",
    statuses: [OrderStatus.COLLECTED, OrderStatus.COMPLETED],
  },
  {
    key: "CANCELLED_OR_REFUNDED",
    label: "Cancelled / refunded",
    statuses: [
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
      OrderStatus.REFUND_PENDING,
      OrderStatus.FAILED,
      OrderStatus.DELIVERY_FAILED,
    ],
  },
];

function rangeStart(range: AnalyticsRange): Date {
  const days = range === "7d" ? 7 : 30;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function eachDayKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    keys.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseAnalyticsRange(raw: string | undefined): AnalyticsRange {
  return raw === "7d" ? "7d" : "30d";
}

export async function getAdminAnalytics(range: AnalyticsRange) {
  const from = rangeStart(range);
  const to = new Date();

  const [
    ordersInRange,
    paymentsInRange,
    collectedHistory,
    orderStatusGroups,
    paymentMixGroups,
    schoolAgg,
    vendorAgg,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: from },
        status: { not: OrderStatus.DRAFT },
      },
      select: {
        createdAt: true,
        totalMinor: true,
        status: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: from },
        purpose: PaymentPurpose.ORDER_CHECKOUT,
      },
      select: {
        createdAt: true,
        status: true,
        method: true,
        amountMinor: true,
      },
    }),
    prisma.orderStatusHistory.count({
      where: {
        toStatus: { in: [OrderStatus.COLLECTED, OrderStatus.COMPLETED] },
        createdAt: { gte: from },
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: {
        createdAt: { gte: from },
        status: { not: OrderStatus.DRAFT },
      },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: {
        createdAt: { gte: from },
        purpose: PaymentPurpose.ORDER_CHECKOUT,
        status: PaymentStatus.SUCCEEDED,
      },
      _count: { _all: true },
      _sum: { amountMinor: true },
    }),
    prisma.order.groupBy({
      by: ["schoolId"],
      where: {
        createdAt: { gte: from },
        status: { not: OrderStatus.DRAFT },
      },
      _count: { _all: true },
      _sum: { totalMinor: true },
      orderBy: { _count: { schoolId: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["vendorId"],
      where: {
        createdAt: { gte: from },
        status: { not: OrderStatus.DRAFT },
        vendorId: { not: null },
      },
      _count: { _all: true },
      _sum: { totalMinor: true },
      orderBy: { _count: { vendorId: "desc" } },
      take: 5,
    }),
  ]);

  const dayKeys = eachDayKeys(from, to);
  const dailyMap = new Map(
    dayKeys.map((date) => [
      date,
      { date, ordersCreated: 0, paymentsSucceeded: 0, paymentsFailed: 0, gmvPaidMinor: 0 },
    ]),
  );

  for (const o of ordersInRange) {
    const row = dailyMap.get(dayKey(o.createdAt));
    if (!row) continue;
    row.ordersCreated += 1;
    if (PAID_OR_LATER.includes(o.status)) {
      row.gmvPaidMinor += o.totalMinor;
    }
  }

  let paymentsSucceeded = 0;
  let paymentsFailed = 0;
  let paymentsSucceededMinor = 0;
  for (const p of paymentsInRange) {
    const row = dailyMap.get(dayKey(p.createdAt));
    if (p.status === PaymentStatus.SUCCEEDED) {
      paymentsSucceeded += 1;
      paymentsSucceededMinor += p.amountMinor;
      if (row) row.paymentsSucceeded += 1;
    } else if (p.status === PaymentStatus.FAILED) {
      paymentsFailed += 1;
      if (row) row.paymentsFailed += 1;
    }
  }

  const gmvPaidMinor = ordersInRange
    .filter((o) => PAID_OR_LATER.includes(o.status))
    .reduce((s, o) => s + o.totalMinor, 0);

  const denom = paymentsSucceeded + paymentsFailed;
  const paymentSuccessRate =
    denom === 0 ? null : Math.round((paymentsSucceeded / denom) * 1000) / 10;

  const statusCount = new Map(orderStatusGroups.map((g) => [g.status, g._count._all]));
  const funnel = FUNNEL_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    count: b.statuses.reduce((s, st) => s + (statusCount.get(st) ?? 0), 0),
  }));

  const paymentMix = paymentMixGroups.map((g) => ({
    method: g.method,
    count: g._count._all,
    amountMinor: g._sum.amountMinor ?? 0,
  }));

  const schoolIds = schoolAgg.map((s) => s.schoolId);
  const vendorIds = vendorAgg.map((v) => v.vendorId).filter((id): id is string => Boolean(id));
  const [schools, vendors] = await Promise.all([
    schoolIds.length
      ? prisma.school.findMany({
          where: { id: { in: schoolIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    vendorIds.length
      ? prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ]);
  const schoolName = new Map(schools.map((s) => [s.id, s.name]));
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

  const topSchools = schoolAgg.map((s) => ({
    id: s.schoolId,
    name: schoolName.get(s.schoolId) ?? "School",
    orderCount: s._count._all,
    gmvMinor: s._sum.totalMinor ?? 0,
  }));
  const topVendors = vendorAgg
    .filter((v): v is typeof v & { vendorId: string } => Boolean(v.vendorId))
    .map((v) => ({
      id: v.vendorId,
      name: vendorName.get(v.vendorId) ?? "Vendor",
      orderCount: v._count._all,
      gmvMinor: v._sum.totalMinor ?? 0,
    }));

  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    kpis: {
      ordersCreated: ordersInRange.length,
      gmvPaidMinor,
      paymentsSucceededMinor,
      paymentSuccessRate,
      collectedCount: collectedHistory,
    },
    daily: dayKeys.map((k) => dailyMap.get(k)!),
    funnel,
    paymentMix,
    topSchools,
    topVendors,
  };
}
