import { Logger } from '@nestjs/common';
import {
  AuditActorType,
  AuditOutcome,
  AuditSeverity,
} from '../generated/prisma/enums';
import { AuditEvent, AUDIT_RETENTION_DAYS } from './audit.constants';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = { auditLog: { create: jest.fn() } };
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditLog.create.mockResolvedValue({});
    service = new AuditService(prisma as never);
  });

  it('writes a redacted record with a fixed one-year expiry', async () => {
    const occurredAt = new Date('2025-09-11T08:30:00.000Z');
    await service.record({
      eventType: AuditEvent.TWO_FACTOR_ENABLED,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.WARNING,
      actorUserId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      targetType: 'user\nforged',
      targetId: '11111111-1111-4111-8111-111111111111',
      requestId: 'request\r\nforged',
      ipAddress: '::ffff:127.0.0.1',
      userAgent: 'Browser\nInjected',
      occurredAt,
      metadata: {
        action: 'enable',
        password: 'must-not-survive',
        nested: { challengeToken: 'must-not-survive', safe: 'retained' },
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const calls = prisma.auditLog.create.mock.calls as unknown as Array<
      [
        {
          data: {
            expiresAt: Date;
            occurredAt: Date;
            [key: string]: unknown;
          };
        },
      ]
    >;
    const data = calls[0][0].data;
    expect(data).toMatchObject({
      eventType: AuditEvent.TWO_FACTOR_ENABLED,
      actorType: AuditActorType.USER,
      actorUserId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      targetType: 'user forged',
      requestId: 'request  forged',
      ipAddress: '127.0.0.1',
      userAgent: 'Browser Injected',
      metadata: {
        action: 'enable',
        password: '[REDACTED]',
        nested: { challengeToken: '[REDACTED]', safe: 'retained' },
      },
      occurredAt,
    });
    expect(data.expiresAt.getTime() - occurredAt.getTime()).toBe(
      AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it('drops malformed network identifiers instead of persisting them', async () => {
    await service.record({
      eventType: AuditEvent.AUTH_LOGIN,
      outcome: AuditOutcome.FAILURE,
      actorUserId: 'not-a-uuid',
      organizationId: 'not-a-uuid',
      ipAddress: 'not-an-ip',
    });

    const calls = prisma.auditLog.create.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(calls[0][0].data).toMatchObject({
      actorType: AuditActorType.ANONYMOUS,
      actorUserId: undefined,
      organizationId: undefined,
      ipAddress: undefined,
    });
  });

  it('does not fail a completed application action when audit storage fails', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    prisma.auditLog.create.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.recordSafely({
        eventType: AuditEvent.AUTH_LOGOUT,
        outcome: AuditOutcome.SUCCESS,
      }),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      'Failed to persist an application audit event',
    );
    logError.mockRestore();
  });
});
