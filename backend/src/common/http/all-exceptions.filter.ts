import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestWithId } from './request-id.middleware';

interface NestErrorBody {
  error?: unknown;
  message?: unknown;
}

interface ExternalHttpError {
  status?: unknown;
  statusCode?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<RequestWithId>();
    const response = httpContext.getResponse<Response>();
    const statusCode = this.getStatusCode(exception);

    const { error, message } = this.getErrorDetails(exception, statusCode);

    if (
      !(exception instanceof HttpException) &&
      statusCode === Number(HttpStatus.INTERNAL_SERVER_ERROR)
    ) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        {
          event: 'http.request.unhandled_exception',
          requestId: request.requestId ?? 'unknown',
          errorType:
            exception instanceof Error ? exception.name : 'UnknownError',
        },
        stack,
      );
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      path: request.originalUrl,
      method: request.method,
      timestamp: new Date().toISOString(),
      requestId: request.requestId ?? 'unknown',
    });
  }

  private getErrorDetails(
    exception: unknown,
    statusCode: number,
  ): { error: string; message: string | string[] } {
    if (!(exception instanceof HttpException)) {
      if (statusCode === Number(HttpStatus.PAYLOAD_TOO_LARGE)) {
        return {
          error: this.getStatusLabel(statusCode),
          message: 'Request body is too large',
        };
      }
      if (statusCode >= 400 && statusCode < 500) {
        return {
          error: this.getStatusLabel(statusCode),
          message: 'Request body is invalid',
        };
      }
      return {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      };
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        error: this.getStatusLabel(statusCode),
        message: exceptionResponse,
      };
    }

    const body = exceptionResponse as NestErrorBody;
    const message =
      typeof body.message === 'string' || Array.isArray(body.message)
        ? (body.message as string | string[])
        : exception.message;

    return {
      error:
        typeof body.error === 'string'
          ? body.error
          : this.getStatusLabel(statusCode),
      message,
    };
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (typeof exception !== 'object' || exception === null) {
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }
    const external = exception as ExternalHttpError;
    const status =
      typeof external.statusCode === 'number'
        ? external.statusCode
        : external.status;
    return typeof status === 'number' && status >= 400 && status <= 599
      ? status
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getStatusLabel(statusCode: number): string {
    const statusName = HttpStatus[statusCode];

    if (typeof statusName !== 'string') {
      return 'Error';
    }

    return statusName
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
