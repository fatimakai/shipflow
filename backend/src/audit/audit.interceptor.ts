import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { catchError, concatMap, from, Observable, throwError } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestWithId } from '../common/http/request-id.middleware';
import {
  AuditActorType,
  AuditOutcome,
  AuditSeverity,
} from '../generated/prisma/enums';
import { AUDIT_EVENT_METADATA } from './audit-event.decorator';
import { AuditService } from './audit.service';
import type { AuditEventOptions, AuditValueReference } from './audit.types';

type AuditedRequest = RequestWithId & {
  user?: Partial<AuthenticatedUser>;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditEventOptions>(
      AUDIT_EVENT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!options || context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AuditedRequest>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      concatMap((value: unknown) =>
        from(
          this.audit.recordSafely(
            this.auditRecord(
              options,
              request,
              value,
              AuditOutcome.SUCCESS,
              response.statusCode,
            ),
          ),
        ).pipe(map(() => value)),
      ),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        return from(
          this.audit.recordSafely(
            this.auditRecord(
              options,
              request,
              undefined,
              AuditOutcome.FAILURE,
              statusCode,
            ),
          ),
        ).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }

  private auditRecord(
    options: AuditEventOptions,
    request: AuditedRequest,
    responseBody: unknown,
    outcome: AuditOutcome,
    statusCode: number,
  ) {
    const actorUserId = this.actorUserId(options, request, responseBody);
    return {
      eventType: options.eventType,
      outcome,
      severity:
        outcome === AuditOutcome.FAILURE
          ? AuditSeverity.WARNING
          : options.severity,
      actorType: this.actorType(options.actor, actorUserId),
      actorUserId,
      organizationId: this.referenceValue(
        options.organization,
        request,
        responseBody,
      ),
      targetType: options.target?.type,
      targetId: this.referenceValue(options.target, request, responseBody),
      reasonCode:
        outcome === AuditOutcome.FAILURE ? `http.${statusCode}` : undefined,
      requestId: request.requestId,
      ipAddress: request.ip ?? request.socket.remoteAddress,
      userAgent: request.get('user-agent'),
      metadata: {
        httpMethod: request.method,
        httpPath: request.path,
        statusCode,
      },
    };
  }

  private actorUserId(
    options: AuditEventOptions,
    request: AuditedRequest,
    responseBody: unknown,
  ): string | undefined {
    if (options.actor === 'response-user') {
      return this.pathValue(responseBody, 'user.id');
    }
    if (options.actor === 'anonymous' || options.actor === 'system') {
      return undefined;
    }
    return typeof request.user?.id === 'string' ? request.user.id : undefined;
  }

  private actorType(
    mode: AuditEventOptions['actor'],
    actorUserId?: string,
  ): AuditActorType {
    if (mode === 'system') return AuditActorType.SYSTEM;
    return actorUserId ? AuditActorType.USER : AuditActorType.ANONYMOUS;
  }

  private referenceValue(
    reference: AuditValueReference | undefined,
    request: AuditedRequest,
    responseBody: unknown,
  ): string | undefined {
    if (!reference) return undefined;
    if (reference.source === 'request-user') {
      return typeof request.user?.id === 'string' ? request.user.id : undefined;
    }
    if (reference.source === 'param') {
      const value = reference.key ? request.params[reference.key] : undefined;
      return typeof value === 'string' ? value : undefined;
    }
    return reference.key
      ? this.pathValue(responseBody, reference.key)
      : undefined;
  }

  private pathValue(value: unknown, path: string): string | undefined {
    let current = value;
    for (const segment of path.split('.')) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === 'string' ? current : undefined;
  }
}
