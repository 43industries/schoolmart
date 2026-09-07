import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { AppError, ValidationError } from "./lib/errors.js";
import { authRoutes, userRoutes, adminUserRoutes } from "./modules/auth/auth.routes.js";
import { schoolRoutes, adminSchoolRoutes } from "./modules/schools/schools.routes.js";
import { parentRoutes } from "./modules/parents/parents.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { adminMarketplaceRoutes, publicCatalogRoutes } from "./modules/vendors/vendors.routes.js";
import { catalogRoutes, schoolCatalogRoutes } from "./modules/catalog/catalog.routes.js";
import { cartRoutes } from "./modules/cart/cart.routes.js";

const app = Fastify({
  logger: config.isDev,
});

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: [config.webUrl, "http://localhost:3000"],
  credentials: true,
});
await app.register(cookie, { secret: config.cookieSecret });
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

app.setErrorHandler((error, _req, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code ?? "ERROR",
      message: error.message,
      ...(error instanceof ValidationError && error.details ? { details: error.details } : {}),
    });
  }

  app.log.error(error);
  return reply.status(500).send({
    error: "INTERNAL_ERROR",
    message: config.isDev ? (error as Error).message : "An unexpected error occurred",
  });
});

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

await app.register(async (v1) => {
  await v1.register(authRoutes, { prefix: "/auth" });
  await v1.register(userRoutes, { prefix: "/users" });
  await v1.register(schoolRoutes, { prefix: "/schools" });
  await v1.register(schoolCatalogRoutes, { prefix: "/schools" });
  await v1.register(parentRoutes, { prefix: "/parents" });
  await v1.register(cartRoutes, { prefix: "/cart" });
  await v1.register(catalogRoutes, { prefix: "/catalog" });
  await v1.register(publicCatalogRoutes, { prefix: "/catalog" });
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
