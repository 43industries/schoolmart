/**
 * Fail fast before Prisma migrate/start if DATABASE_URL is missing or looks unusable.
 * Render Internal hosts (dpg-…-a) only work on the running Web Service, not local/build.
 */
const raw = (process.env.DATABASE_URL ?? "").trim();

if (!raw) {
  console.error(
    "FATAL: DATABASE_URL is missing.\n" +
      "Render → Postgres → Connect → copy Internal Database URL onto the Web Service Environment, then redeploy.",
  );
  process.exit(1);
}

let url;
try {
  url = new URL(raw);
} catch {
  console.error("FATAL: DATABASE_URL is not a valid URL.");
  process.exit(1);
}

const host = url.hostname;
const isRenderInternal = /^dpg-[a-z0-9]+-a$/i.test(host);

// Local runs cannot use Render internal hostnames
if (isRenderInternal && !process.env.RENDER && !process.env.RAILWAY_ENVIRONMENT) {
  console.error(
    `FATAL: DATABASE_URL host "${host}" is a Render Internal address.\n` +
      "It only works on Render. Locally use the External Database URL from Render → Postgres → Connect.",
  );
  process.exit(1);
}

// Ensure SSL for Render Postgres when params are missing
if (host.includes("render.com") || isRenderInternal) {
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "15");
  }
  process.env.DATABASE_URL = url.toString();
}

console.log(`DATABASE_URL OK (host=${host})`);
