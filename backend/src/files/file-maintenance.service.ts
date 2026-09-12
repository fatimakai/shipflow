import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FileMalwareStatus, FileStatus } from '../generated/prisma/enums';
import {
  FILE_AUDIT_RETENTION_MS,
  FILE_MAINTENANCE_INTERVAL_MS,
  FILE_RECONCILIATION_INTERVAL_MS,
  FILE_SCAN_TIMEOUT_MS,
  FILE_STALE_PENDING_MS,
} from './file.constants';
import {
  InjectFileStorage,
  type ObjectStorageProvider,
} from './storage/file-storage.types';
import {
  InjectMalwareScanner,
  type MalwareScanner,
  type MalwareScanResult,
} from './malware/malware-scanner.types';

@Injectable()
export class FileMaintenanceService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(FileMaintenanceService.name);
  private maintenanceTimer?: NodeJS.Timeout;
  private reconciliationTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectFileStorage() private readonly storage: ObjectStorageProvider,
    @InjectMalwareScanner() private readonly malwareScanner: MalwareScanner,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.maintain();
    this.maintenanceTimer = setInterval(
      () => void this.maintain(),
      FILE_MAINTENANCE_INTERVAL_MS,
    );
    this.reconciliationTimer = setInterval(
      () => void this.reconcileOrphans(),
      FILE_RECONCILIATION_INTERVAL_MS,
    );
    this.maintenanceTimer.unref();
    this.reconciliationTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
  }

  async maintain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processScans();
      await this.retryLifecycleTags();
      await this.purgeExpiredRecords();
      await this.prisma.storedFile.deleteMany({
        where: {
          status: FileStatus.PURGED,
          auditExpiresAt: { lte: new Date() },
        },
      });
    } catch (error) {
      this.logger.error(
        'File lifecycle maintenance failed',
        this.errorStack(error),
      );
    } finally {
      this.running = false;
    }
  }

  async reconcileOrphans(): Promise<number> {
    try {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const objects = await this.storage.listObjects('objects');
      const candidates = objects.filter(
        (object) =>
          object.lastModified && object.lastModified.getTime() <= cutoff,
      );
      if (candidates.length === 0) return 0;
      const records = await this.prisma.storedFile.findMany({
        where: {
          storageProvider: this.storage.provider,
          objectKey: { in: candidates.map((object) => object.key) },
        },
        select: { objectKey: true },
      });
      const known = new Set(records.map((record) => record.objectKey));
      const orphans = candidates.filter((object) => !known.has(object.key));
      for (const orphan of orphans) await this.storage.deleteObject(orphan.key);
      return orphans.length;
    } catch (error) {
      this.logger.error(
        'File orphan reconciliation failed',
        this.errorStack(error),
      );
      return 0;
    }
  }

  private async processScans(): Promise<void> {
    if (!this.malwareScanner.enabled) return;
    const files = await this.prisma.storedFile.findMany({
      where: {
        storageProvider: this.storage.provider,
        status: FileStatus.SCANNING,
      },
      orderBy: { uploadedAt: 'asc' },
      take: 100,
    });
    for (const file of files) {
      if (
        file.uploadedAt &&
        file.uploadedAt.getTime() <= Date.now() - FILE_SCAN_TIMEOUT_MS
      ) {
        await this.failScan(
          file.id,
          FileMalwareStatus.FAILED,
          file.scanAttempts + 1,
        );
        continue;
      }
      try {
        const object = await this.storage.inspectObject(file.objectKey);
        const result = await this.malwareScanner.scan(object.body);
        await this.applyScanResult(file.id, file.scanAttempts, result);
      } catch {
        const attempts = file.scanAttempts + 1;
        if (attempts >= 3) {
          await this.failScan(file.id, FileMalwareStatus.FAILED, attempts);
        } else {
          await this.prisma.storedFile.updateMany({
            where: { id: file.id, status: FileStatus.SCANNING },
            data: {
              scanAttempts: attempts,
              lastLifecycleError: 'Could not read the malware scan result',
            },
          });
        }
        this.logger.warn(`Could not read malware result for file ${file.id}`);
      }
    }
  }

  private async applyScanResult(
    fileId: string,
    attempts: number,
    result: MalwareScanResult,
  ): Promise<void> {
    if (result === 'clean') {
      const file = await this.prisma.storedFile.findUnique({
        where: { id: fileId },
        select: { objectKey: true },
      });
      if (file) await this.storage.setLifecycleState(file.objectKey, 'ready');
      await this.prisma.storedFile.updateMany({
        where: { id: fileId, status: FileStatus.SCANNING },
        data: {
          status: FileStatus.READY,
          malwareStatus: FileMalwareStatus.CLEAN,
          scanCompletedAt: new Date(),
          lastLifecycleError: null,
        },
      });
      return;
    }
    if (result === 'infected') {
      const file = await this.prisma.storedFile.findUnique({
        where: { id: fileId },
        select: { objectKey: true },
      });
      if (file) {
        await this.storage.setLifecycleState(file.objectKey, 'rejected');
      }
      await this.prisma.storedFile.updateMany({
        where: { id: fileId, status: FileStatus.SCANNING },
        data: {
          status: FileStatus.REJECTED,
          malwareStatus: FileMalwareStatus.INFECTED,
          scanCompletedAt: new Date(),
          purgeAfter: new Date(),
          lastLifecycleError: 'Malware was detected in the uploaded file',
        },
      });
      return;
    }

    const nextAttempts = attempts + 1;
    const malwareStatus =
      result === 'unsupported'
        ? FileMalwareStatus.UNSUPPORTED
        : FileMalwareStatus.FAILED;
    if (nextAttempts >= 3) {
      await this.failScan(fileId, malwareStatus, nextAttempts);
    } else {
      await this.prisma.storedFile.updateMany({
        where: { id: fileId, status: FileStatus.SCANNING },
        data: { scanAttempts: nextAttempts, malwareStatus },
      });
    }
  }

  private async failScan(
    fileId: string,
    malwareStatus: FileMalwareStatus,
    scanAttempts: number,
  ): Promise<void> {
    await this.prisma.storedFile.updateMany({
      where: { id: fileId, status: FileStatus.SCANNING },
      data: {
        status: FileStatus.FAILED,
        malwareStatus,
        scanAttempts,
        scanCompletedAt: new Date(),
        purgeAfter: new Date(),
        lastLifecycleError: 'Malware scanning did not complete successfully',
      },
    });
  }

  private async purgeExpiredRecords(): Promise<void> {
    const stalePendingCutoff = new Date(Date.now() - FILE_STALE_PENDING_MS);
    const files = await this.prisma.storedFile.findMany({
      where: {
        storageProvider: this.storage.provider,
        OR: [
          {
            status: FileStatus.PENDING,
            reservationExpiresAt: { lte: stalePendingCutoff },
          },
          {
            status: {
              in: [FileStatus.DELETED, FileStatus.REJECTED, FileStatus.FAILED],
            },
            purgeAfter: { lte: new Date() },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const file of files) {
      try {
        await this.storage.deleteObject(file.objectKey);
        const now = new Date();
        await this.prisma.storedFile.update({
          where: { id: file.id },
          data: {
            status: FileStatus.PURGED,
            purgedAt: now,
            auditExpiresAt: new Date(now.getTime() + FILE_AUDIT_RETENTION_MS),
            lastLifecycleError: null,
          },
        });
      } catch {
        await this.prisma.storedFile.update({
          where: { id: file.id },
          data: {
            lastLifecycleError: 'Object deletion failed and will be retried',
          },
        });
      }
    }
  }

  private async retryLifecycleTags(): Promise<void> {
    const files = await this.prisma.storedFile.findMany({
      where: {
        storageProvider: this.storage.provider,
        lastLifecycleError: 'Object lifecycle tag update will be retried',
        status: {
          in: [
            FileStatus.SCANNING,
            FileStatus.READY,
            FileStatus.DELETED,
            FileStatus.REJECTED,
          ],
        },
      },
      take: 100,
    });
    for (const file of files) {
      let state: 'scanning' | 'ready' | 'deleted' | 'rejected';
      if (file.status === FileStatus.SCANNING) state = 'scanning';
      else if (file.status === FileStatus.READY) state = 'ready';
      else if (file.status === FileStatus.DELETED) state = 'deleted';
      else if (file.status === FileStatus.REJECTED) state = 'rejected';
      else continue;
      try {
        await this.storage.setLifecycleState(file.objectKey, state);
        await this.prisma.storedFile.update({
          where: { id: file.id },
          data: { lastLifecycleError: null },
        });
      } catch {
        this.logger.warn(`Could not update lifecycle tag for file ${file.id}`);
      }
    }
  }

  private errorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }
}
