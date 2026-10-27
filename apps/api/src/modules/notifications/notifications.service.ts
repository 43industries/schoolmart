import { prisma, NotificationChannel, type Prisma } from "@schoolmart/db";
import { config } from "../../config.js";
import { NotFoundError } from "../../lib/errors.js";
import { sendEmail, sendSms } from "./channels.js";

type Db = Prisma.TransactionClient | typeof prisma;

export async function notifyUser(
  params: {
    userId: string | null | undefined;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    /** Skip external SMS/email even when enabled (e.g. high-frequency polls). */
    inAppOnly?: boolean;
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

  if (params.inAppOnly || db !== prisma) {
    // External channels only after the transaction commits; callers can invoke fanOut separately.
    return;
  }

  if (config.notifications.externalEnabled || config.isDev) {
    void fanOutExternal(params.userId, params.title, params.body).catch(() => {});
  }
}

async function fanOutExternal(userId: string, title: string, body: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phoneE164: true },
  });
  if (!user) return;

  const text = `${title}\n${body}`;
  if (user.phoneE164) {
    const sms = await sendSms(user.phoneE164, text);
    if (sms.ok) {
      await prisma.notification.create({
        data: {
          userId,
          channel: NotificationChannel.SMS,
          title,
          body,
          metadata: { delivery: sms.detail ?? "ok" },
        },
      });
    }
  }
  if (user.email) {
    const mail = await sendEmail(user.email, title, body);
    if (mail.ok) {
      await prisma.notification.create({
        data: {
          userId,
          channel: NotificationChannel.EMAIL,
          title,
          body,
          metadata: { delivery: mail.detail ?? "ok" },
        },
      });
    }
  }
}

/** Call after a transaction that used notifyUser(..., tx) so SMS/email still fan out. */
export async function fanOutNotification(userId: string | null | undefined, title: string, body: string) {
  if (!userId) return;
  if (!(config.notifications.externalEnabled || config.isDev)) return;
  await fanOutExternal(userId, title, body).catch(() => {});
}

export async function listNotifications(userId: string, limit = 30) {
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, channel: NotificationChannel.IN_APP },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    }),
    prisma.notification.count({ where: { userId, channel: NotificationChannel.IN_APP, read: false } }),
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
    where: { userId, read: false, channel: NotificationChannel.IN_APP },
    data: { read: true },
  });
}
