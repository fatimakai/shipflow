import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  AuditActorType,
  AuditOutcome,
  AuditSeverity,
} from '../generated/prisma/enums';
import { AuditEvent } from './audit.constants';
import { AuditInterceptor } from './audit.interceptor';
import type { AuditEventOptions } from './audit.types';

describe('AuditInterceptor', () => {
  const audit = { recordSafely: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  let interceptor: AuditInterceptor;
  let context: ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    audit.recordSafely.mockResolvedValue(undefined);
    interceptor = new AuditInterceptor(
      reflector as unknown as Reflector,
      audit as never,
    );
    context = {
      getType: () => 'http',
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          path: '/api/v1/organizations/org-id/members/member-id',
          params: {
            organizationId: '22222222-2222-4222-8222-222222222222',
            membershipId: '33333333-3333-4333-8333-333333333333',
          },
          requestId: 'request-id',
          ip: '127.0.0.1',
          socket: {},
          get: (header: string) =>
            header === 'user-agent' ? 'Test browser' : undefined,
          user: { id: '11111111-1111-4111-8111-111111111111' },
        }),
        getResponse: () => ({ statusCode: 200 }),
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext;
  });

  it('records a successful domain event with actor and target context', async () => {
    const options: AuditEventOptions = {
      eventType: AuditEvent.ORGANIZATION_MEMBER_ROLE_CHANGED,
      organization: { source: 'param', key: 'organizationId' },
      target: { type: 'membership', source: 'param', key: 'membershipId' },
    };
    reflector.getAllAndOverride.mockReturnValue(options);

    await expect(
      firstValueFrom(
        interceptor.intercept(context, {
          handle: () => of({ id: 'member-id' }),
        } as CallHandler),
      ),
    ).resolves.toEqual({ id: 'member-id' });

    expect(audit.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEvent.ORGANIZATION_MEMBER_ROLE_CHANGED,
        outcome: AuditOutcome.SUCCESS,
        actorType: AuditActorType.USER,
        actorUserId: '11111111-1111-4111-8111-111111111111',
        organizationId: '22222222-2222-4222-8222-222222222222',
        targetType: 'membership',
        targetId: '33333333-3333-4333-8333-333333333333',
        requestId: 'request-id',
      }),
    );
  });

  it('records sanitized failure classification and preserves the exception', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      eventType: AuditEvent.TWO_FACTOR_DISABLED,
      severity: AuditSeverity.CRITICAL,
      target: { type: 'user', source: 'request-user' },
    } satisfies AuditEventOptions);
    const error = new BadRequestException('Sensitive internal detail');

    await expect(
      firstValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => error),
        } as CallHandler),
      ),
    ).rejects.toBe(error);

    expect(audit.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditOutcome.FAILURE,
        severity: AuditSeverity.WARNING,
        reasonCode: 'http.400',
      }),
    );
    const calls = audit.recordSafely.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    expect(JSON.stringify(calls[0][0])).not.toContain(
      'Sensitive internal detail',
    );
  });

  it('does no audit work for endpoints without audit metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      firstValueFrom(
        interceptor.intercept(context, {
          handle: () => of('ok'),
        } as CallHandler),
      ),
    ).resolves.toBe('ok');
    expect(audit.recordSafely).not.toHaveBeenCalled();
  });
});
