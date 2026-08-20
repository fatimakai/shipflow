import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { API_PREFIX, API_VERSION } from './common/http/api.constants';
import { requestIdMiddleware } from './common/http/request-id.middleware';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import { RequestTimeoutInterceptor } from './common/http/request-timeout.interceptor';
import { EnvironmentVariables } from './config/env.validation';
import { setupSwagger } from './swagger/swagger.setup';

export function configureApplication(
  app: INestApplication,
  configService: ConfigService<EnvironmentVariables, true>,
): void {
  const corsOrigins = configService
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',');
  const isProduction =
    configService.getOrThrow<string>('NODE_ENV') === 'production';
  const bodyLimit = configService.getOrThrow<number>('HTTP_BODY_LIMIT_BYTES');
  const express = app.getHttpAdapter().getInstance() as Express;
  const expressApp = app as NestExpressApplication;

  express.disable('x-powered-by');
  express.set(
    'trust proxy',
    configService.getOrThrow<number>('HTTP_TRUST_PROXY_HOPS'),
  );
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: false }
        : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(requestIdMiddleware);
  expressApp.useBodyParser('json', { limit: bodyLimit });
  expressApp.useBodyParser('urlencoded', {
    extended: true,
    limit: bodyLimit,
  });
  app.use((_request: Request, response: Response, next: NextFunction): void => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new RequestTimeoutInterceptor(
      configService.getOrThrow<number>('HTTP_REQUEST_TIMEOUT_MS'),
    ),
  );
  app.enableCors({
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 600,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: corsOrigins,
  });

  if (configService.getOrThrow<boolean>('SWAGGER_ENABLED')) {
    setupSwagger(app, configService);
  }
}
