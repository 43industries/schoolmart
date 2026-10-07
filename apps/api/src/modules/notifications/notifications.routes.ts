import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.service.js";

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (req, reply) => {
    const query = req.query as { limit?: string };
    return reply.send(await listNotifications(req.user!.sub, parseInt(query.limit ?? "30", 10)));
  });

  app.post("/read-all", { preHandler: [authenticate] }, async (req, reply) => {
    await markAllNotificationsRead(req.user!.sub);
    return reply.send({ success: true });
  });

  app.post("/:id/read", { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await markNotificationRead(req.user!.sub, id);
    return reply.send({ success: true });
  });
}
