import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  createAdminUserSchema,
} from "@schoolmart/shared";
import {
  registerParent,
  login,
  logout,
  refreshAccessToken,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
  resetPassword,
  createAdminUser,
} from "./auth.service.js";
import { authenticate, requireSuperAdmin } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { config } from "../../config.js";
import { ValidationError } from "../../lib/errors.js";

function setAuthCookies(reply: { setCookie: (name: string, value: string, opts: object) => void }, accessToken: string, refreshToken: string) {
  const cookieOpts = {
    httpOnly: true,
    secure: !config.isDev,
    sameSite: "lax" as const,
    path: "/",
  };
  reply.setCookie("accessToken", accessToken, { ...cookieOpts, maxAge: 900 });
  reply.setCookie("refreshToken", refreshToken, { ...cookieOpts, maxAge: 604800 });
}

function clearAuthCookies(reply: { clearCookie: (name: string, opts: object) => void }) {
  const opts = { path: "/" };
  reply.clearCookie("accessToken", opts);
  reply.clearCookie("refreshToken", opts);
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const result = await registerParent(parsed.data, auditContextFromRequest(req));
    return reply.status(201).send({ success: true, userId: result.userId });
  });

  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const result = await login(parsed.data, auditContextFromRequest(req));
    setAuthCookies(reply, result.accessToken, result.refreshToken);

    return reply.send({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  });

  app.post("/logout", { preHandler: [authenticate] }, async (req, reply) => {
    const cookies = req.cookies as Record<string, string | undefined>;
    const refreshToken = cookies.refreshToken;
    if (refreshToken && req.user) {
      await logout(refreshToken, req.user.sub, auditContextFromRequest(req, req.user.sub));
    }
    clearAuthCookies(reply);
    return reply.send({ success: true });
  });

  app.post("/refresh", async (req, reply) => {
    const cookies = req.cookies as Record<string, string | undefined>;
    const body = req.body as { refreshToken?: string } | undefined;
    const refreshToken = body?.refreshToken ?? cookies.refreshToken;
    if (!refreshToken) throw new ValidationError("Refresh token required");

    const tokens = await refreshAccessToken(refreshToken, auditContextFromRequest(req));
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return reply.send(tokens);
  });

  app.post("/forgot-password", async (req, reply) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed");

    const result = await forgotPassword(parsed.data.email);
    return reply.send(result);
  });

  app.post("/reset-password", async (req, reply) => {
    const schema = z.object({ token: z.string(), password: z.string().min(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed");

    await resetPassword(parsed.data.token, parsed.data.password, auditContextFromRequest(req));
    return reply.send({ success: true });
  });
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [authenticate] }, async (req, reply) => {
    const profile = await getUserProfile(req.user!.sub);
    return reply.send(profile);
  });

  app.patch("/me", { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const profile = await updateUserProfile(req.user!.sub, parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.send(profile);
  });
}

export async function adminUserRoutes(app: FastifyInstance) {
  app.post("/users", { preHandler: [authenticate, requireSuperAdmin()] }, async (req, reply) => {
    const parsed = createAdminUserSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const user = await createAdminUser(parsed.data, auditContextFromRequest(req, req.user!.sub));
    return reply.status(201).send({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
    });
  });
}
