#!/usr/bin/env node
/**
 * Authenticated checkout smoke (wallet path) against a running API + seeded DB.
 *
 * Prerequisites:
 *   pnpm db:migrate && pnpm db:seed
 *   API running on API_URL (default http://localhost:4000/api/v1)
 *
 * Usage:
 *   node scripts/e2e-checkout-smoke.mjs
 */
const API = (process.env.API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@SchoolMart2026";

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

async function login(identifier) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password: PASSWORD }),
  });
  const data = await json(res);
  const token = data.accessToken ?? data.tokens?.accessToken;
  if (!token) throw new Error("No access token in login response");
  return token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

let failed = false;
function pass(msg) {
  console.log(`PASS ${msg}`);
}
function fail(msg) {
  failed = true;
  console.log(`FAIL ${msg}`);
}

try {
  const parentToken = await login("parent1@demo.ke");
  pass("parent login");

  const children = await json(await fetch(`${API}/parents/children`, { headers: auth(parentToken) }));
  const link = (children.children ?? children).find?.((c) => c.status === "ACTIVE") ?? children.children?.[0];
  if (!link?.student?.id || !link?.student?.school?.id) {
    fail("no active child link for parent1");
  } else {
    pass(`child ${link.student.firstName} @ ${link.student.school.name}`);

    const catalog = await json(
      await fetch(
        `${API}/catalog/search?schoolId=${link.student.school.id}&limit=5`,
        { headers: auth(parentToken) },
      ),
    );
    const products = catalog.products ?? [];
    if (products.length < 1) {
      fail("catalog empty for school");
    } else {
      // Prefer two different vendors when available (multi-vendor path).
      const byVendor = new Map();
      for (const p of products) {
        const vid = p.vendor?.id ?? p.vendorId;
        if (vid && !byVendor.has(vid)) byVendor.set(vid, p);
      }
      const picks = [...byVendor.values()].slice(0, 2);
      if (picks.length === 0) picks.push(products[0]);

      await fetch(`${API}/cart`, { method: "DELETE", headers: auth(parentToken) }).catch(() => null);

      for (const p of picks) {
        await json(
          await fetch(`${API}/cart/items`, {
            method: "POST",
            headers: auth(parentToken),
            body: JSON.stringify({
              productId: p.id,
              quantity: 1,
              schoolId: link.student.school.id,
              studentId: link.student.id,
            }),
          }),
        );
      }
      pass(`cart loaded with ${picks.length} vendor group(s)`);

      const checkout = await json(
        await fetch(`${API}/cart/checkout`, {
          method: "POST",
          headers: auth(parentToken),
          body: JSON.stringify({
            studentId: link.student.id,
            schoolId: link.student.school.id,
            paymentMethod: "WALLET",
          }),
        }),
      );

      if (checkout.status === "PAID" && checkout.order) {
        const n = checkout.orders?.length ?? 1;
        pass(`wallet checkout PAID · ${n} order(s) · ${checkout.order.orderNumber}`);
      } else if (checkout.status === "PENDING_APPROVAL") {
        pass(`wallet checkout pending approval (${checkout.spendRequestId}) — rules OK`);
      } else {
        fail(`unexpected checkout status ${checkout.status}`);
      }
    }
  }

  const adminToken = await login("admin@schoolmart.demo");
  const stats = await json(await fetch(`${API}/admin/stats`, { headers: auth(adminToken) }));
  if (typeof stats.schools === "number") pass(`admin stats schools=${stats.schools} orders=${stats.orders}`);
  else fail("admin stats missing");
} catch (err) {
  fail(err.message);
}

process.exit(failed ? 1 : 0);
