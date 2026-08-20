import {
  NotificationCategory,
  NotificationType,
} from '../generated/prisma/enums';
import { NOTIFICATION_RETENTION_DAYS } from './notification.constants';
import { writeNotification } from './notification.writer';

describe('writeNotification', () => {
  const transaction = {
    notificationPreference: { findUnique: jest.fn() },
    notification: { upsert: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.notificationPreference.findUnique.mockResolvedValue(null);
    transaction.notification.upsert.mockResolvedValue({});
  });

  it('honors the optional organization preference', async () => {
    transaction.notificationPreference.findUnique.mockResolvedValue({
      organizationEnabled: false,
    });

    await writeNotification(transaction as never, {
      userId: 'user-id',
      organizationId: 'organization-id',
      category: NotificationCategory.ORGANIZATION,
      type: NotificationType.ORGANIZATION_ROLE_CHANGED,
      title: 'Role changed',
      message: 'Your role changed.',
      dedupeKey: 'operation-id',
    });

    expect(transaction.notification.upsert).not.toHaveBeenCalled();
  });

  it('always writes mandatory security notifications with a 90-day expiry', async () => {
    const before = Date.now();
    await writeNotification(transaction as never, {
      userId: 'user-id',
      category: NotificationCategory.SECURITY,
      type: NotificationType.PASSWORD_CHANGED,
      title: 'Password changed',
      message: 'Your password changed.',
      dedupeKey: 'reset-id',
    });

    expect(
      transaction.notificationPreference.findUnique,
    ).not.toHaveBeenCalled();
    const calls = transaction.notification.upsert.mock
      .calls as unknown as Array<
      [
        {
          where: { userId_dedupeKey: { userId: string; dedupeKey: string } };
          create: { createdAt: Date; expiresAt: Date };
          update: object;
        },
      ]
    >;
    const call = calls[0][0];
    expect(call.where.userId_dedupeKey).toEqual({
      userId: 'user-id',
      dedupeKey: 'reset-id',
    });
    expect(call.update).toEqual({});
    expect(
      call.create.expiresAt.getTime() - call.create.createdAt.getTime(),
    ).toBe(NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    expect(call.create.createdAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
