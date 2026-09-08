import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");
const sharedRoot = path.join(monorepoRoot, "packages/shared");

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
