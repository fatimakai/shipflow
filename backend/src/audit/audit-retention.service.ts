import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AUDIT_RETENTION_INTERVAL_MS } from './audit.constants';

@Injectable()
export class AuditRetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AuditRetentionService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.prune();
    this.timer = setInterval(
      () => void this.prune(),
      AUDIT_RETENTION_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async prune(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
      return result.count;
    } catch {
      this.logger.error('Failed to prune expired audit records');
      return 0;
    } finally {
      this.running = false;
    }
  }
}
