import { createServer } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { configureHttpServer } from './http-server.setup';

describe('configureHttpServer', () => {
  it('sets bounded socket and request behavior', () => {
    const server = createServer();
    const config = new ConfigService<EnvironmentVariables, true>({
      HTTP_REQUEST_TIMEOUT_MS: 30000,
      HTTP_HEADERS_TIMEOUT_MS: 15000,
      HTTP_KEEP_ALIVE_TIMEOUT_MS: 5000,
      HTTP_MAX_REQUESTS_PER_SOCKET: 1000,
    });

    configureHttpServer(server, config);

    expect(server.requestTimeout).toBe(30000);
    expect(server.headersTimeout).toBe(15000);
    expect(server.keepAliveTimeout).toBe(5000);
    expect(server.maxRequestsPerSocket).toBe(1000);
    server.close();
  });
});
