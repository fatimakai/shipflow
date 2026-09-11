import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuditEvent, AUDIT_RETENTION_DAYS } from '../src/audit/audit.constants';
import { configureApplication } from '../src/app.setup';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';
import {
  TRANSACTIONAL_EMAIL_DELIVERY,
  type EmailDeliveryResult,
  type TransactionalEmailDelivery,
} from '../src/email/email.types';
import {
  AuditActorType,
  AuditOutcome,
  AuditSeverity,
} from '../src/generated/prisma/enums';

class NoopDelivery implements TransactionalEmailDelivery {
  sendEmailVerification(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendPasswordReset(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendOrganizationInvitation(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendSecurityNotice(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }
}

describe('Application audit log (e2e)', () => {
  const marker = randomUUID();
  const email = `audit-${marker}@example.test`;
  const password = 'correct horse battery staple';
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TRANSACTIONAL_EMAIL_DELIVERY)
      .useValue(new NoopDelivery())
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    configureApplication(app, configService);
    await app.init();
    prisma = app.get(PrismaService);
  });

  it('records successful authenticated actions without request secrets', async () => {
    const requestId = `audit-register-${marker}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Request-ID', requestId)
      .set('User-Agent', 'Audit browser')
      .send({ email, password, displayName: 'Audit User' })
      .expect(201);
    userId = (response.body as { user: { id: string } }).user.id;

    const record = await prisma.auditLog.findFirstOrThrow({
      where: { requestId },
    });
    expect(record).toMatchObject({
      eventType: AuditEvent.AUTH_REGISTERED,
      actorType: AuditActorType.USER,
      actorUserId: userId,
      targetType: 'user',
      targetId: userId,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.INFO,
      requestId,
      userAgent: 'Audit browser',
      metadata: {
        httpMethod: 'POST',
        httpPath: '/api/v1/auth/register',
        statusCode: 201,
      },
    });
    expect(record.expiresAt.getTime() - record.occurredAt.getTime()).toBe(
      AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(JSON.stringify(record)).not.toContain(password);
    expect(JSON.stringify(record)).not.toContain(email);
  });

  it('records authentication failures without an account identifier', async () => {
    const requestId = `audit-login-failure-${marker}`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Request-ID', requestId)
      .send({ email, password: 'incorrect password' })
      .expect(401);

    const record = await prisma.auditLog.findFirstOrThrow({
      where: { requestId },
    });
    expect(record).toMatchObject({
      eventType: AuditEvent.AUTH_LOGIN,
      actorType: AuditActorType.ANONYMOUS,
      actorUserId: null,
      outcome: AuditOutcome.FAILURE,
      severity: AuditSeverity.WARNING,
      reasonCode: 'http.401',
    });
    expect(JSON.stringify(record)).not.toContain('incorrect password');
    expect(JSON.stringify(record)).not.toContain(email);
  });

  it('records access-token guard rejections that occur before interceptors', async () => {
    const requestId = `audit-access-rejection-${marker}`;
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('X-Request-ID', requestId)
      .expect(401);

    const record = await prisma.auditLog.findFirstOrThrow({
      where: { requestId },
    });
    expect(record).toMatchObject({
      eventType: AuditEvent.AUTH_ACCESS_TOKEN_REJECTED,
      actorType: AuditActorType.ANONYMOUS,
      outcome: AuditOutcome.FAILURE,
      severity: AuditSeverity.WARNING,
      reasonCode: 'http.401',
      metadata: {
        httpMethod: 'GET',
        httpPath: '/api/v1/auth/me',
        statusCode: 401,
      },
    });
  });

  it('enforces immutability and the retention deadline in PostgreSQL', async () => {
    const requestId = `audit-register-${marker}`;
    const record = await prisma.auditLog.findFirstOrThrow({
      where: { requestId },
    });

    await expect(
      prisma.auditLog.update({
        where: { id: record.id },
        data: { reasonCode: 'tampered' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.auditLog.delete({ where: { id: record.id } }),
    ).rejects.toThrow();

    const expired = await prisma.auditLog.create({
      data: {
        eventType: 'test.retention.expired',
        actorType: AuditActorType.SYSTEM,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.INFO,
        occurredAt: new Date('2020-01-01T00:00:00.000Z'),
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });
    expect(expired.expiresAt).toEqual(new Date('2020-12-31T00:00:00.000Z'));
    await expect(
      prisma.auditLog.delete({ where: { id: expired.id } }),
    ).resolves.toMatchObject({ id: expired.id });
  });

  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });
});
