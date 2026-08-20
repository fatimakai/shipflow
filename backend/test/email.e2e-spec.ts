import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';
import {
  EMAIL_PROVIDER_CLIENT,
  EmailProviderError,
  type EmailProvider,
} from '../src/email/email.types';
import {
  EmailCategory,
  EmailDeliveryStatus,
} from '../src/generated/prisma/enums';

describe('Transactional email webhooks (e2e)', () => {
  const webhookKey = randomBytes(32);
  const webhookSecret = `whsec_${webhookKey.toString('base64')}`;
  const providerMessageId = `email_${randomUUID()}`;
  const idempotencyKey = randomUUID();
  const failedDeliveryEmail = `email-failure-${randomUUID()}@example.test`;
  const failingProvider: EmailProvider = {
    name: 'resend',
    send: jest
      .fn()
      .mockRejectedValue(new EmailProviderError('invalid_from_address', false)),
  };
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let deliveryId: string;

  beforeAll(async () => {
    process.env.RESEND_WEBHOOK_SECRET = webhookSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_PROVIDER_CLIENT)
      .useValue(failingProvider)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    configureApplication(app, configService);
    await app.init();
    prisma = app.get(PrismaService);

    const delivery = await prisma.emailDelivery.create({
      data: {
        attempts: 1,
        category: EmailCategory.SECURITY_NOTICE,
        idempotencyKey,
        provider: 'resend',
        providerMessageId,
        recipientEmail: 'webhook-test@example.com',
        sentAt: new Date(),
        status: EmailDeliveryStatus.SENT,
      },
    });
    deliveryId = delivery.id;
  });

  afterAll(async () => {
    await prisma.emailDelivery.deleteMany({
      where: { recipientEmail: failedDeliveryEmail },
    });
    await prisma.user.deleteMany({ where: { email: failedDeliveryEmail } });
    await prisma.emailWebhookEvent.deleteMany({ where: { providerMessageId } });
    await prisma.emailDelivery.deleteMany({ where: { id: deliveryId } });
    await app.close();
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it('preserves registration when transactional delivery fails', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Email Failure User',
        email: failedDeliveryEmail,
        password: 'correct horse battery staple',
      })
      .expect(201);

    await expect(
      prisma.user.findUnique({ where: { email: failedDeliveryEmail } }),
    ).resolves.toEqual(expect.objectContaining({ email: failedDeliveryEmail }));
    await expect(
      prisma.emailDelivery.findFirstOrThrow({
        where: { recipientEmail: failedDeliveryEmail },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        lastErrorCode: 'invalid_from_address',
        status: EmailDeliveryStatus.FAILED,
      }),
    );
  });

  it('verifies, deduplicates, and applies delivery events in order', async () => {
    const deliveredAt = new Date();
    const deliveredEvent = emailEvent('email.delivered', deliveredAt);
    const deliveredHeaders = sign(deliveredEvent, `evt_${randomUUID()}`);

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/resend')
      .set(deliveredHeaders)
      .send(deliveredEvent)
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/resend')
      .set(deliveredHeaders)
      .send(deliveredEvent)
      .expect(204);

    const olderFailure = emailEvent(
      'email.failed',
      new Date(deliveredAt.getTime() - 60_000),
    );
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/resend')
      .set(sign(olderFailure, `evt_${randomUUID()}`))
      .send(olderFailure)
      .expect(204);

    const delivery = await prisma.emailDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    expect(delivery.status).toBe(EmailDeliveryStatus.DELIVERED);
    expect(delivery.deliveredAt?.toISOString()).toBe(deliveredAt.toISOString());
    await expect(
      prisma.emailWebhookEvent.count({ where: { providerMessageId } }),
    ).resolves.toBe(2);
  });

  it('rejects a webhook with an invalid signature', async () => {
    const event = emailEvent('email.delivered', new Date());

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/resend')
      .set({
        'svix-id': `evt_${randomUUID()}`,
        'svix-signature': 'v1,invalid',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
      })
      .send(event)
      .expect(401);
  });

  function emailEvent(
    type: 'email.delivered' | 'email.failed',
    createdAt: Date,
  ) {
    return {
      type,
      created_at: createdAt.toISOString(),
      data: {
        created_at: createdAt.toISOString(),
        email_id: providerMessageId,
        from: 'NestShip <no-reply@mail.example.com>',
        subject: 'Security notice',
        to: ['webhook-test@example.com'],
        ...(type === 'email.failed'
          ? { failed: { reason: 'temporary_failure' } }
          : {}),
      },
    };
  }

  function sign(payload: object, id: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', webhookKey)
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64');

    return {
      'svix-id': id,
      'svix-signature': `v1,${signature}`,
      'svix-timestamp': timestamp,
    };
  }
});
