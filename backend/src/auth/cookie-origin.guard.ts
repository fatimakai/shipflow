import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuditEvent } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedRequest } from './auth.types';
import type { RequestWithId } from '../common/http/request-id.middleware';
import { EnvironmentVariables } from '../config/env.validation';
import { AuditOutcome, AuditSeverity } from '../generated/prisma/enums';

const TRUSTED_FETCH_SITES = new Set(['same-origin', 'same-site']);

interface SourceOrigin {
  malformed: boolean;
  value?: string;
}

@Injectable()
export class CookieOriginGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & RequestWithId>();
    const response = http.getResponse<Response>();
    const sourceOrigin = this.getSourceOrigin(request);
    const fetchSite = request.get('sec-fetch-site')?.toLowerCase();

    response.vary('Origin');
    response.vary('Sec-Fetch-Site');

    if (fetchSite === 'cross-site' || fetchSite === 'none') {
      await this.reject(request, `fetch_metadata.${fetchSite}`);
    }

    const allowedOrigins = this.configService
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',');

    if (sourceOrigin.malformed) {
      await this.reject(request, 'source_origin.malformed');
    }

    if (sourceOrigin.value && !allowedOrigins.includes(sourceOrigin.value)) {
      await this.reject(request, 'source_origin.not_allowed');
    }

    if (
      !sourceOrigin.value &&
      fetchSite !== undefined &&
      !TRUSTED_FETCH_SITES.has(fetchSite)
    ) {
      await this.reject(request, 'fetch_metadata.untrusted');
    }

    return true;
  }

  private getSourceOrigin(request: Request): SourceOrigin {
    const origin = request.get('origin');

    if (origin) {
      if (origin === 'null') return { malformed: true };

      try {
        const parsed = new URL(origin);
        const isOriginOnly =
          (parsed.pathname === '/' || parsed.pathname === '') &&
          !parsed.search &&
          !parsed.hash &&
          !parsed.username &&
          !parsed.password;

        return isOriginOnly
          ? { malformed: false, value: parsed.origin }
          : { malformed: true };
      } catch {
        return { malformed: true };
      }
    }

    const referer = request.get('referer');

    if (!referer) return { malformed: false };

    try {
      return { malformed: false, value: new URL(referer).origin };
    } catch {
      return { malformed: true };
    }
  }

  private async reject(
    request: Request & RequestWithId,
    reasonCode: string,
  ): Promise<never> {
    const authenticatedRequest = request as AuthenticatedRequest &
      RequestWithId;

    await this.audit.recordSafely({
      eventType: AuditEvent.SECURITY_COOKIE_REQUEST_REJECTED,
      outcome: AuditOutcome.FAILURE,
      severity: AuditSeverity.WARNING,
      actorUserId: authenticatedRequest.user?.id,
      reasonCode,
      requestId: request.requestId,
      ipAddress: request.ip ?? request.socket.remoteAddress,
      userAgent: request.get('user-agent'),
      metadata: {
        fetchSite: request.get('sec-fetch-site'),
        httpMethod: request.method,
        httpPath: request.path,
      },
    });

    throw new ForbiddenException('Request origin is not allowed');
  }
}
