import type { Prisma } from '../generated/prisma/client';
import {
  NotificationCategory,
  type NotificationType,
} from '../generated/prisma/enums';
import { NOTIFICATION_RETENTION_DAYS } from './notification.constants';

type NotificationTransaction = Pick<
  Prisma.TransactionClient,
  'notification' | 'notificationPreference'
>;

export interface WriteNotificationInput {
  userId: string;
  organizationId?: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  actionPath?: string;
  metadata?: Prisma.InputJsonValue;
  dedupeKey: string;
  createdAt?: Date;
}

export async function writeNotification(
  transaction: NotificationTransaction,
  input: WriteNotificationInput,
): Promise<void> {
  if (input.category === NotificationCategory.ORGANIZATION) {
    const preference = await transaction.notificationPreference.findUnique({
      where: { userId: input.userId },
      select: { organizationEnabled: true },
    });
    if (preference?.organizationEnabled === false) {
      return;
    }
  }

  const now = new Date();
  const createdAt =
    input.createdAt && input.createdAt.getTime() <= now.getTime()
      ? input.createdAt
      : now;
  await transaction.notification.upsert({
    where: {
      userId_dedupeKey: {
        userId: input.userId,
        dedupeKey: input.dedupeKey,
      },
    },
    create: {
      userId: input.userId,
      organizationId: input.organizationId,
      category: input.category,
      type: input.type,
      title: input.title,
      message: input.message,
      actionPath: input.actionPath,
      metadata: input.metadata ?? {},
      dedupeKey: input.dedupeKey,
      createdAt,
      expiresAt: new Date(
        createdAt.getTime() + NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      ),
    },
    update: {},
  });
}
