import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { configureHttpServer } from './common/http/http-server.setup';
import { JsonLogger } from './common/logging/json-logger';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const port = configService.getOrThrow<number>('PORT');

  app.useLogger(
    new JsonLogger(
      configService.getOrThrow('APP_NAME'),
      configService.getOrThrow('LOG_LEVEL'),
    ),
  );
  configureApplication(app, configService);
  configureHttpServer(app.getHttpServer(), configService);
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  new JsonLogger('ShipFlow API', 'error').fatal({
    event: 'application.bootstrap_failed',
    error,
  });
  process.exitCode = 1;
});
