import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuditService } from '../audit/audit.service';
import type { EnvironmentVariables } from '../config/env.validation';
import { AuditOutcome, AuditSeverity } from '../generated/prisma/enums';
import { CookieOriginGuard } from './cookie-origin.guard';

describe('CookieOriginGuard', () => {
  const recordSafely = jest.fn<Promise<void>, [unknown]>();
  const audit = { recordSafely } as unknown as AuditService;
  const config = {
    getOrThrow: jest.fn(() => 'https://app.shipflow.test'),
  } as unknown as ConfigService<EnvironmentVariables, true>;

  beforeEach(() => {
    jest.clearAllMocks();
    recordSafely.mockResolvedValue(undefined);
  });

  it('accepts an allowlisted Origin with trusted Fetch Metadata', async () => {
    const { context, vary } = createContext({
      origin: 'https://app.shipflow.test',
      'sec-fetch-site': 'same-site',
    });

    await expect(
      new CookieOriginGuard(config, audit).canActivate(context),
    ).resolves.toBe(true);
    expect(vary).toHaveBeenCalledWith('Origin');
    expect(vary).toHaveBeenCalledWith('Sec-Fetch-Site');
    expect(recordSafely).not.toHaveBeenCalled();
  });

  it('uses Referer as the fallback source origin', async () => {
    const { context } = createContext({
      referer: 'https://app.shipflow.test/settings/security?from=profile',
    });

    await expect(
      new CookieOriginGuard(config, audit).canActivate(context),
    ).resolves.toBe(true);
  });

  it('allows non-browser clients when browser-controlled signals are absent', async () => {
    const { context } = createContext({});

    await expect(
      new CookieOriginGuard(config, audit).canActivate(context),
    ).resolves.toBe(true);
  });

  it('rejects cross-site browser requests even if they claim an allowed Origin', async () => {
    const { context } = createContext({
      origin: 'https://app.shipflow.test',
      'sec-fetch-site': 'cross-site',
      'user-agent': 'Browser Test',
    });

    await expect(
      new CookieOriginGuard(config, audit).canActivate(context),
    ).rejects.toThrow(ForbiddenException);
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'security.cookie_request.rejected',
        outcome: AuditOutcome.FAILURE,
        severity: AuditSeverity.WARNING,
        reasonCode: 'fetch_metadata.cross-site',
        requestId: 'request-id',
        metadata: {
          fetchSite: 'cross-site',
          httpMethod: 'POST',
          httpPath: '/api/v1/auth/refresh',
        },
      }),
    );
  });

  it.each([
    [{ origin: 'https://attacker.test' }, 'source_origin.not_allowed'],
    [{ origin: 'null' }, 'source_origin.malformed'],
    [{ referer: 'not-a-url' }, 'source_origin.malformed'],
    [{ 'sec-fetch-site': 'none' }, 'fetch_metadata.none'],
  ])('rejects an untrusted browser signal', async (headers, reasonCode) => {
    const { context } = createContext(headers);

    await expect(
      new CookieOriginGuard(config, audit).canActivate(context),
    ).rejects.toThrow('Request origin is not allowed');
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ reasonCode }),
    );
  });
});

function createContext(headers: Record<string, string>): {
  context: ExecutionContext;
  vary: jest.Mock;
} {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const request = {
    get: (name: string) => normalizedHeaders[name.toLowerCase()],
    headers: normalizedHeaders,
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/v1/auth/refresh',
    requestId: 'request-id',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
  const vary = jest.fn();
  const response = { vary } as unknown as Response;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return { context, vary };
}
