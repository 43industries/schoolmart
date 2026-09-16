import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { AppError, ValidationError } from "./lib/errors.js";
import { authRoutes, userRoutes, adminUserRoutes } from "./modules/auth/auth.routes.js";
import { schoolRoutes, adminSchoolRoutes } from "./modules/schools/schools.routes.js";
import { parentRoutes } from "./modules/parents/parents.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { catalogRoutes, schoolCatalogRoutes } from "./modules/catalog/catalog.routes.js";
import { cartRoutes } from "./modules/cart/cart.routes.js";
import { walletRoutes } from "./modules/wallets/wallets.routes.js";
import { publicStudentRoutes, studentPortalRoutes, parentStudentRequestRoutes } from "./modules/students/students.portal.routes.js";
import {
  schoolActivityRoutes,
  parentActivityRoutes,
  studentActivityRoutes,
} from "./modules/activities/activities.routes.js";
import {
  adminMarketplaceRoutes,
  publicCatalogRoutes,
  publicVendorRoutes,
  vendorCatalogRoutes,
} from "./modules/vendors/vendors.routes.js";
import { publicDeliveryRoutes } from "./modules/deliveries/deliveries.routes.js";
import { ensureUploadDirs, getUploadRoot, MAX_IMAGE_BYTES } from "./modules/uploads/uploads.service.js";

const app = Fastify({
  logger: {
    level: config.isDev ? "info" : "warn",
  },
});

await ensureUploadDirs();

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = [config.webUrl, "http://localhost:3000", "http://127.0.0.1:3000"];
    if (allowed.includes(origin) || (config.isDev && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/.test(origin))) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true,
});
await app.register(cookie, { secret: config.cookieSecret });
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await app.register(multipart, {
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 5,
  },
});
await app.register(fastifyStatic, {
  root: getUploadRoot(),
  prefix: "/api/v1/uploads/",
  decorateReply: false,
});

// Allow empty JSON bodies (e.g. POST /auth/refresh with `{}` or blank).
app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
  try {
    const text = typeof body === "string" ? body : "";
    done(null, text.length ? JSON.parse(text) : {});
  } catch (err) {
    done(err as Error, undefined);
  }
});

app.setErrorHandler((error, req, reply) => {
  const requestId = req.id;
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      req.log.error({ err: error, requestId, route: req.routeOptions?.url }, error.message);
    } else if (error.statusCode >= 400) {
      req.log.warn({ requestId, route: req.routeOptions?.url, code: error.code }, error.message);
    }
    return reply.status(error.statusCode).send({
      error: error.code ?? "ERROR",
      message: error.message,
      requestId,
      ...(error instanceof ValidationError && error.details ? { details: error.details } : {}),
    });
  }

  req.log.error(
    { err: error, requestId, route: req.routeOptions?.url },
    (error as Error).message ?? "Internal error",
  );
  return reply.status(500).send({
    error: "INTERNAL_ERROR",
    message: config.isDev ? (error as Error).message : "An unexpected error occurred",
    requestId,
  });
});

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

await app.register(async (v1) => {
  await v1.register(authRoutes, { prefix: "/auth" });
  await v1.register(userRoutes, { prefix: "/users" });
  await v1.register(schoolRoutes, { prefix: "/schools" });
  await v1.register(schoolCatalogRoutes, { prefix: "/schools" });
  await v1.register(schoolActivityRoutes, { prefix: "/schools" });
  await v1.register(parentRoutes, { prefix: "/parents" });
  await v1.register(walletRoutes, { prefix: "/parents" });
  await v1.register(parentActivityRoutes, { prefix: "/parents" });
  await v1.register(parentStudentRequestRoutes, { prefix: "/parents" });
  await v1.register(publicStudentRoutes, { prefix: "/students" });
  await v1.register(studentPortalRoutes, { prefix: "/students" });
  await v1.register(studentActivityRoutes, { prefix: "/students" });
  await v1.register(cartRoutes, { prefix: "/cart" });
  await v1.register(catalogRoutes, { prefix: "/catalog" });
  await v1.register(publicCatalogRoutes, { prefix: "/catalog" });
  await v1.register(publicVendorRoutes, { prefix: "/vendors" });
  await v1.register(vendorCatalogRoutes, { prefix: "/vendors" });
  await v1.register(publicDeliveryRoutes, { prefix: "/deliveries" });
  await v1.register(adminSchoolRoutes, { prefix: "/admin" });
  await v1.register(adminUserRoutes, { prefix: "/admin" });
  await v1.register(adminRoutes, { prefix: "/admin" });
  await v1.register(adminMarketplaceRoutes, { prefix: "/admin" });
}, { prefix: "/api/v1" });

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`SchoolMart API running at http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
