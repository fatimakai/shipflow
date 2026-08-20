import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NOTIFICATION_RETENTION_INTERVAL_MS } from './notification.constants';

@Injectable()
export class NotificationRetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationRetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.prune();
    this.timer = setInterval(
      () => void this.prune(),
      NOTIFICATION_RETENTION_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async prune(): Promise<number> {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
      return result.count;
    } catch {
      this.logger.error('Failed to prune expired notifications');
      return 0;
    }
  }
}
