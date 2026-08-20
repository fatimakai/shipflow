import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { RequestWithId } from './request-id.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithId>();
    const response = httpContext.getResponse<Response>();
    const startedAt = Date.now();
    const requestId = request.requestId ?? 'unknown';
    this.logger.log({
      event: 'http.request.started',
      requestId,
      method: request.method,
      path: request.path,
    });

    return next.handle().pipe(
      tap({
        complete: () => {
          this.logger.log({
            event: 'http.request.completed',
            requestId,
            method: request.method,
            path: request.path,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          });
        },
        error: (error: unknown) => {
          const statusCode =
            error instanceof HttpException
              ? error.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;

          this.logger.warn({
            event: 'http.request.failed',
            requestId,
            method: request.method,
            path: request.path,
            statusCode,
            durationMs: Date.now() - startedAt,
          });
        },
      }),
    );
  }
}
