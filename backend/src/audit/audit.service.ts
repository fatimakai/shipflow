import { isIP } from 'node:net';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { AuditActorType, AuditSeverity } from '../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import { AUDIT_RETENTION_DAYS } from './audit.constants';
import type { AuditRecordInput } from './audit.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_CODE_KEYS = new Set(['eventcode', 'reasoncode', 'statuscode']);
const SENSITIVE_KEYS = new Set([
  'authorization',
  'backupcode',
  'challengesecret',
  'challengetoken',
  'code',
  'cookie',
  'credentials',
  'currentpassword',
  'manualentrykey',
  'password',
  'provisioninguri',
  'recoverycode',
  'refreshtoken',
  'setcookie',
  'signature',
  'totpcode',
  'twofactorsecret',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    const occurredAt = this.occurredAt(input.occurredAt);
    const actorUserId = this.uuid(input.actorUserId);
    const organizationId = this.uuid(input.organizationId);
    const actorType =
      input.actorType ??
      (actorUserId ? AuditActorType.USER : AuditActorType.ANONYMOUS);

    await this.prisma.auditLog.create({
      data: {
        eventType: input.eventType,
        actorType,
        actorUserId,
        organizationId,
        targetType: this.text(input.targetType, 64),
        targetId: this.text(input.targetId, 255),
        outcome: input.outcome,
        severity: input.severity ?? AuditSeverity.INFO,
        reasonCode: this.text(input.reasonCode, 100),
        requestId: this.text(input.requestId, 128),
        ipAddress: this.ipAddress(input.ipAddress),
        userAgent: this.text(input.userAgent, 512),
        metadata: this.sanitizeMetadata(input.metadata),
        occurredAt,
        expiresAt: new Date(
          occurredAt.getTime() + AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });
  }

  async recordSafely(input: AuditRecordInput): Promise<void> {
    try {
      await this.record(input);
    } catch {
      this.logger.error('Failed to persist an application audit event');
    }
  }

  private occurredAt(value?: Date): Date {
    const now = new Date();
    return value && value.getTime() <= now.getTime() ? value : now;
  }

  private uuid(value?: string): string | undefined {
    return value && UUID_PATTERN.test(value) ? value : undefined;
  }

  private ipAddress(value?: string): string | undefined {
    if (!value) return undefined;
    const normalized = value.startsWith('::ffff:') ? value.slice(7) : value;
    return isIP(normalized) ? normalized : undefined;
  }

  private text(value: string | undefined, limit: number): string | undefined {
    if (!value) return undefined;
    const sanitized = Array.from(value)
      .map((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127 ? ' ' : character;
      })
      .join('')
      .trim();
    return sanitized ? sanitized.slice(0, limit) : undefined;
  }

  private sanitizeMetadata(
    value?: Prisma.InputJsonValue,
  ): Prisma.InputJsonValue {
    return this.sanitizeValue(value ?? {}, 0) as Prisma.InputJsonValue;
  }

  private sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > 6) return '[TRUNCATED]';
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') return this.text(value, 500) ?? '';
    if (Array.isArray(value)) {
      return value
        .slice(0, 50)
        .map((item) => this.sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'bigint') return value.toString().slice(0, 500);
    if (typeof value !== 'object') return null;

    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [
          this.text(key, 100) ?? 'field',
          this.isSensitiveKey(key)
            ? '[REDACTED]'
            : this.sanitizeValue(item, depth + 1),
        ]),
    );
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SAFE_CODE_KEYS.has(normalized)) return false;
    return (
      SENSITIVE_KEYS.has(normalized) ||
      normalized.endsWith('password') ||
      normalized.endsWith('secret') ||
      normalized.endsWith('signature') ||
      normalized.endsWith('token') ||
      normalized.endsWith('credential') ||
      normalized.endsWith('apikey')
    );
  }
}
