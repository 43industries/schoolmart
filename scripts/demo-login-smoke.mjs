#!/usr/bin/env node
/**
 * Smoke-check every demo login against a running API.
 * Usage: API_URL=http://localhost:4000/api/v1 node scripts/demo-login-smoke.mjs
 * Warm budget: each login (after the first) should complete in under 2s.
 */
const API_URL = (process.env.API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@SchoolMart2026";
const BUDGET_MS = Number(process.env.LOGIN_BUDGET_MS ?? 2000);

const ACCOUNTS = [
  ["Super Admin", "admin@schoolmart.demo", "SUPER_ADMIN"],
  ["Finance", "finance@schoolmart.demo", "FINANCE"],
  ["Support", "support@schoolmart.demo", "SUPPORT"],
  ["School Admin", "admin@greenfield.demo", "SCHOOL_ADMIN"],
  ["Parent", "parent1@demo.ke", "PARENT"],
  ["Student", "student.brian@demo.ke", "STUDENT"],
  ["Vendor", "vendor.kitchen@demo.ke", "VENDOR"],
  ["Driver", "driver@demo.ke", "DRIVER"],
];

let failed = false;
for (const [label, identifier, role] of ACCOUNTS) {
  const started = performance.now();
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password: PASSWORD }),
    });
    const ms = Math.round(performance.now() - started);
    const data = await res.json().catch(() => ({}));
    const roles = data.profile?.roles?.map((r) => r.role) ?? data.user?.roles?.map((r) => r.role) ?? [];
    const ok = res.ok && roles.includes(role);
    const slow = ms > BUDGET_MS;
    if (!ok || slow) failed = true;
    console.log(`${ok ? "PASS" : "FAIL"} ${label} ${identifier} role=${roles.join(",") || "?"} ${ms}ms${slow ? ` (over ${BUDGET_MS}ms budget)` : ""}${res.ok ? "" : ` status=${res.status} ${data.message ?? ""}`}`);
  } catch (err) {
    failed = true;
    console.log(`FAIL ${label} ${identifier} ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
