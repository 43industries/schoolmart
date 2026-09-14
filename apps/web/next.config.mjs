import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");
const sharedRoot = path.join(monorepoRoot, "packages/shared");

function normalizeOrigin(value) {
  return (value ?? "").trim().replace(/\/$/, "");
}

/** Public browser API base (may be absolute or same-origin `/api/v1`). */
const publicApiUrl = normalizeOrigin(process.env.NEXT_PUBLIC_API_URL);
/** Server-only Render/Railway origin for Vercel rewrites, e.g. https://svc.onrender.com */
const apiOrigin = normalizeOrigin(process.env.API_ORIGIN);

const publicIsAbsolute =
  /^https?:\/\//i.test(publicApiUrl) && !/localhost|127\.0\.0\.1/i.test(publicApiUrl);
const originOk = Boolean(apiOrigin) && !/localhost|127\.0\.0\.1/i.test(apiOrigin);

if (process.env.VERCEL && !publicIsAbsolute && !originOk) {
  throw new Error(
    "Vercel builds need a backend URL. Set either:\n" +
      "  • API_ORIGIN=https://YOUR-SERVICE.onrender.com  (recommended — same-origin /api/v1 proxy), or\n" +
      "  • NEXT_PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com/api/v1  (direct browser→API)\n" +
      "in Project Settings → Environment Variables (Production), then redeploy.\n" +
      `Got NEXT_PUBLIC_API_URL=${publicApiUrl || "(unset)"} API_ORIGIN=${apiOrigin || "(unset)"}`,
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle workspace package into the Next serverless output
  transpilePackages: ["@schoolmart/shared"],
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/*": [
      "../../packages/shared/dist/**/*",
      "../../packages/shared/package.json",
      "../../packages/shared/src/**/*",
    ],
  },
  // Avoid Vercel image-optimizer serverless crashes on large local PNGs
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Same-origin proxy: browser → /api/v1/* → Render/Railway (avoids NEXT_PUBLIC + CORS issues)
    if (!process.env.VERCEL || publicIsAbsolute || !originOk) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Prefer built dist on Vercel (turbo builds shared before web)
      "@schoolmart/shared": path.join(sharedRoot, "dist/index.js"),
    };
    return config;
  },
};

export default nextConfig;
