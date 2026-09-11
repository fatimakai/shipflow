import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApplication } from './../src/app.setup';
import { API_VERSION } from './../src/common/http/api.constants';
import { ApiErrorResponseDto } from './../src/common/http/dto/api-error-response.dto';
import { EnvironmentVariables } from './../src/config/env.validation';
import {
  LivenessResponseDto,
  ReadinessResponseDto,
} from './../src/health/dto/health-response.dto';

interface OpenApiDocumentResponse {
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, unknown>;
}

class ValidationProbeDto {
  @IsString()
  name!: string;
}

@Controller({ path: 'validation-probe', version: API_VERSION })
class ValidationProbeController {
  @Post()
  validate(@Body() body: ValidationProbeDto): ValidationProbeDto {
    return body;
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ValidationProbeController],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    configureApplication(app, configService);
    await app.init();
  });

  it('serves the versioned API and preserves a valid request ID', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .set('x-request-id', 'e2e-request-id')
      .expect(200)
      .expect('x-request-id', 'e2e-request-id')
      .expect('Hello World!');
  });

  it('applies provider-independent security and cache headers', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('cache-control', 'no-store')
      .expect(
        'permissions-policy',
        'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
      )
      .expect('referrer-policy', 'no-referrer')
      .expect('x-content-type-options', 'nosniff')
      .expect('x-frame-options', 'DENY')
      .expect((response) => {
        expect(response.headers).not.toHaveProperty('x-powered-by');
      });
  });

  it('returns liveness and readiness health information', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect((response) => {
        const body = response.body as LivenessResponseDto;

        expect(body).toMatchObject({
          status: 'ok',
          service: 'ShipFlow API',
        });
        expect(body.timestamp).toEqual(expect.any(String));
        expect(body.uptime).toEqual(expect.any(Number));
      });

    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect((response) => {
        const body = response.body as ReadinessResponseDto;

        expect(body).toMatchObject({
          status: 'ok',
          checks: { configuration: 'up', database: 'up' },
        });
      });
  });

  it('rejects properties outside a DTO allowlist', () => {
    return request(app.getHttpServer())
      .post('/api/v1/validation-probe')
      .send({ name: 'ShipFlow', unexpected: true })
      .expect(400)
      .expect((response) => {
        const body = response.body as ApiErrorResponseDto;

        expect(body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          path: '/api/v1/validation-probe',
          method: 'POST',
        });
        expect(body.message).toContain('property unexpected should not exist');
        expect(body.requestId).toEqual(expect.any(String));
      });
  });

  it('rejects JSON request bodies above the configured limit', () => {
    return request(app.getHttpServer())
      .post('/api/v1/validation-probe')
      .send({ name: 'ShipFlow', padding: 'x'.repeat(1024 * 1024) })
      .expect(413);
  });

  it('returns the standard error contract for unknown routes', () => {
    return request(app.getHttpServer())
      .get('/missing')
      .expect(404)
      .expect((response) => {
        const body = response.body as ApiErrorResponseDto;

        expect(body).toMatchObject({
          statusCode: 404,
          error: 'Not Found',
          path: '/missing',
          method: 'GET',
        });
        expect(body.requestId).toBe(response.headers['x-request-id']);
      });
  });

  it('allows configured browser origins', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .set('origin', 'http://localhost:5173')
      .expect(200)
      .expect('access-control-allow-origin', 'http://localhost:5173')
      .expect('access-control-allow-credentials', 'true');
  });

  it('does not grant CORS access to unconfigured origins', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .set('origin', 'https://untrusted.example')
      .expect(200)
      .expect((response) => {
        expect(response.headers).not.toHaveProperty(
          'access-control-allow-origin',
        );
      });
  });

  it('blocks untrusted browser origins from endpoints that set auth cookies', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('origin', 'https://untrusted.example')
      .send({
        email: 'blocked-origin@example.test',
        password: 'Valid-password-123',
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('origin', 'https://untrusted.example')
      .send({
        email: 'blocked-origin@example.test',
        password: 'Valid-password-123',
      })
      .expect(403);
  });

  it('blocks cross-site Fetch Metadata on cookie endpoints', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('origin', 'http://localhost:5173')
      .set('sec-fetch-site', 'cross-site')
      .send({
        email: 'fetch-metadata@example.test',
        password: 'Valid-password-123',
      })
      .expect(403)
      .expect('vary', /Origin/)
      .expect('vary', /Sec-Fetch-Site/);
  });

  it('uses the Referer origin when Origin is unavailable', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('referer', 'http://localhost:5173/login?source=test')
      .send({
        email: 'referer-fallback@example.test',
        password: 'Valid-password-123',
      })
      .expect(401);
  });

  it('publishes the OpenAPI document', () => {
    return request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect((response) => {
        const body = response.body as OpenApiDocumentResponse;

        expect(body.info).toMatchObject({
          title: 'ShipFlow API',
          version: API_VERSION,
        });
        expect(body.paths).toHaveProperty('/api/v1/health/live');
        expect(body.paths).toHaveProperty('/api/v1/auth/register');
        expect(body.paths).toHaveProperty('/api/v1/auth/refresh');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
