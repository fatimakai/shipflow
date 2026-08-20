import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Prisma, Notification } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type {
  NotificationListQueryDto,
  NotificationOrganizationFilterDto,
  UpdateNotificationPreferenceDto,
} from './dto/notification-request.dto';
import type {
  NotificationListResponseDto,
  NotificationMarkAllReadResponseDto,
  NotificationPreferenceResponseDto,
  NotificationResponseDto,
  NotificationUnreadCountResponseDto,
} from './dto/notification-response.dto';

interface NotificationCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<NotificationListResponseDto> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const where = this.activeWhere(userId, query.organizationId);
    if (query.unreadOnly) {
      where.readAt = null;
    }
    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ];
    }

    const records = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = records.length > query.limit;
    const page = hasMore ? records.slice(0, query.limit) : records;
    const last = page.at(-1);

    return {
      items: page.map((notification) => this.toResponse(notification)),
      nextCursor:
        hasMore && last
          ? this.encodeCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }

  async unreadCount(
    userId: string,
    query: NotificationOrganizationFilterDto,
  ): Promise<NotificationUnreadCountResponseDto> {
    return {
      count: await this.prisma.notification.count({
        where: {
          ...this.activeWhere(userId, query.organizationId),
          readAt: null,
        },
      }),
    };
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const now = new Date();
      const notification = await transaction.notification.findFirst({
        where: {
          id: notificationId,
          userId,
          createdAt: { lte: now },
          expiresAt: { gt: now },
        },
      });
      if (!notification) {
        throw new NotFoundException('Notification not found');
      }
      if (notification.readAt) {
        return this.toResponse(notification);
      }
      const updated = await transaction.notification.update({
        where: { id: notification.id },
        data: { readAt: now },
      });
      return this.toResponse(updated);
    });
  }

  async markAllRead(
    userId: string,
    dto: NotificationOrganizationFilterDto,
  ): Promise<NotificationMarkAllReadResponseDto> {
    const cutoff = new Date();
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        organizationId: dto.organizationId,
        readAt: null,
        expiresAt: { gt: cutoff },
        createdAt: { lte: cutoff },
      },
      data: { readAt: cutoff },
    });
    return { updatedCount: result.count };
  }

  async getPreferences(
    userId: string,
  ): Promise<NotificationPreferenceResponseDto> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    return this.preferenceResponse(preference?.organizationEnabled ?? true);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, organizationEnabled: dto.organizationEnabled },
      update: { organizationEnabled: dto.organizationEnabled },
    });
    return this.preferenceResponse(preference.organizationEnabled);
  }

  private activeWhere(
    userId: string,
    organizationId?: string,
  ): Prisma.NotificationWhereInput {
    const now = new Date();
    return {
      userId,
      organizationId,
      createdAt: { lte: now },
      expiresAt: { gt: now },
    };
  }

  private toResponse(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      organizationId: notification.organizationId,
      category: notification.category,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      actionPath: notification.actionPath,
      metadata: notification.metadata as Record<string, unknown>,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
    };
  }

  private preferenceResponse(
    organizationEnabled: boolean,
  ): NotificationPreferenceResponseDto {
    return {
      organizationEnabled,
      securityEnabled: true,
      billingEnabled: true,
    };
  }

  private encodeCursor(cursor: NotificationCursor): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: cursor.createdAt.toISOString(),
        id: cursor.id,
      }),
    ).toString('base64url');
  }

  private decodeCursor(value: string): NotificationCursor {
    try {
      const decoded = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as { createdAt?: unknown; id?: unknown };
      const createdAt = new Date(String(decoded.createdAt));
      if (
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string' ||
        !isUUID(decoded.id) ||
        !Number.isFinite(createdAt.getTime())
      ) {
        throw new Error('Invalid cursor');
      }
      return { createdAt, id: decoded.id };
    } catch {
      throw new BadRequestException('Invalid notification cursor');
    }
  }
}
