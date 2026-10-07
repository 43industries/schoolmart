import { prisma, NotificationChannel, type Prisma } from "@schoolmart/db";
import { NotFoundError } from "../../lib/errors.js";

type Db = Prisma.TransactionClient | typeof prisma;

export async function notifyUser(
  params: {
    userId: string | null | undefined;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  },
  db: Db = prisma,
) {
  if (!params.userId) return;
  await db.notification.create({
    data: {
      userId: params.userId,
      channel: NotificationChannel.IN_APP,
      title: params.title,
      body: params.body,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listNotifications(userId: string, limit = 30) {
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { notifications, unread };
}

export async function markNotificationRead(userId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  if (result.count === 0) throw new NotFoundError("Notification not found");
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
