import type { Server } from 'node:http';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';

export function configureHttpServer(
  server: Server,
  config: ConfigService<EnvironmentVariables, true>,
): void {
  server.requestTimeout = config.getOrThrow('HTTP_REQUEST_TIMEOUT_MS');
  server.headersTimeout = config.getOrThrow('HTTP_HEADERS_TIMEOUT_MS');
  server.keepAliveTimeout = config.getOrThrow('HTTP_KEEP_ALIVE_TIMEOUT_MS');
  server.maxRequestsPerSocket = config.getOrThrow(
    'HTTP_MAX_REQUESTS_PER_SOCKET',
  );
}
