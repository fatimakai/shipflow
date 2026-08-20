import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TokenService } from '../src/auth/token.service';
import { configureApplication } from '../src/app.setup';
import {
  BILLING_PROVIDER_CLIENT,
  type BillingProvider,
  type BillingWebhookEvent,
  type ProviderSubscription,
} from '../src/billing/billing.types';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';
import {
  BillingInterval,
  MembershipRole,
  NotificationType,
  PlanCode,
  SubscriptionStatus,
} from '../src/generated/prisma/enums';

class CapturingBillingProvider implements BillingProvider {
  readonly name = 'stripe' as const;
  readonly checkoutInputs: Array<Record<string, unknown>> = [];
  readonly portalReturnUrls: string[] = [];
  readonly subscriptions = new Map<string, ProviderSubscription>();
  nextEvent?: BillingWebhookEvent;
  chargeSubscriptionId?: string;

  createCustomer(input: { organizationId: string }) {
    return Promise.resolve({ customerId: `cus_test_${input.organizationId}` });
  }

  createCheckoutSession(input: Record<string, unknown>) {
    this.checkoutInputs.push(input);
    return Promise.resolve({
      sessionId: `cs_test_${randomUUID()}`,
      url: 'https://checkout.stripe.test/session',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  }

  createPortalSession(_customerId: string, returnUrl: string) {
    this.portalReturnUrls.push(returnUrl);
    return Promise.resolve({ url: 'https://billing.stripe.test/portal' });
  }

  verifyWebhook(_rawBody: Buffer, signature: string) {
    if (signature !== 'valid' || !this.nextEvent) {
      throw new Error('Invalid signature');
    }
    return this.nextEvent;
  }

  retrieveSubscription(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return Promise.reject(new Error('Subscription not found'));
    }
    return Promise.resolve(subscription);
  }

  cancelSubscriptionNow(subscriptionId: string) {
    const current = this.subscriptions.get(subscriptionId);
    if (!current) {
      return Promise.reject(new Error('Subscription not found'));
    }
    const canceled = {
      ...current,
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      endedAt: new Date(),
    };
    this.subscriptions.set(subscriptionId, canceled);
    return Promise.resolve(canceled);
  }

  resolveSubscriptionForCharge() {
    return Promise.resolve(this.chargeSubscriptionId);
  }
}

describe('Stripe billing (e2e)', () => {
  const marker = randomUUID();
  const eventIds: string[] = [];
  const provider = new CapturingBillingProvider();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let organizationId: string;
  let ownerId: string;
  let ownerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BILLING_PROVIDER_CLIENT)
      .useValue(provider)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    configureApplication(app, configService);
    await app.init();
    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);

    const [owner, admin] = await Promise.all([
      prisma.user.create({
        data: { email: `billing-owner-${marker}@example.test` },
      }),
      prisma.user.create({
        data: { email: `billing-admin-${marker}@example.test` },
      }),
    ]);
    const organization = await prisma.organization.create({
      data: {
        name: `Billing ${marker}`,
        slug: `billing-${marker}`,
        ownerId: owner.id,
        memberships: {
          create: [
            { userId: owner.id, role: MembershipRole.OWNER },
            { userId: admin.id, role: MembershipRole.ADMIN },
          ],
        },
      },
    });
    ownerId = owner.id;
    organizationId = organization.id;
    [ownerToken, adminToken] = await Promise.all([
      tokenService.signAccessToken(owner),
      tokenService.signAccessToken(admin),
    ]);
  });

  it('publishes plans and restricts organization billing to Owners', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/billing/plans')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: Array<{ code: PlanCode; annualPriceCents: number }>;
        };
        expect(body.items).toEqual([
          expect.objectContaining({ code: PlanCode.FREE }),
          expect.objectContaining({
            code: PlanCode.PRO,
            annualPriceCents: 29000,
          }),
        ]);
      });
    await expect(
      prisma.plan.update({
        where: { code: PlanCode.PRO },
        data: { annualPriceCents: 1 },
      }),
    ).rejects.toThrow();

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/billing`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          hasPaidAccess: boolean;
          plan: { code: PlanCode };
        };
        expect(body.hasPaidAccess).toBe(false);
        expect(body.plan.code).toBe(PlanCode.FREE);
      });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/billing`)
      .auth(adminToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/billing/checkout-session`)
      .auth(adminToken, { type: 'bearer' })
      .send({ interval: BillingInterval.MONTHLY })
      .expect(403);
  });

  it('creates Checkout and Portal sessions with the approved trial policy', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/billing/checkout-session`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ interval: BillingInterval.ANNUAL })
      .expect(201)
      .expect((response) => {
        const body = response.body as { sessionId: string; url: string };
        expect(body.sessionId).toMatch(/^cs_test_/);
        expect(body.url).toBe('https://checkout.stripe.test/session');
      });
    expect(provider.checkoutInputs.at(-1)).toEqual(
      expect.objectContaining({
        cancelUrl: 'http://localhost:5173/billing?checkout=canceled',
        interval: BillingInterval.ANNUAL,
        priceId: 'price_local_pro_annual',
        successUrl:
          'http://localhost:5173/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        trialDays: 14,
      }),
    );
    const checkoutCount = provider.checkoutInputs.length;
    const reservation = await prisma.billingCheckoutSession.findUniqueOrThrow({
      where: { organizationId },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/billing/checkout-session`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ interval: BillingInterval.ANNUAL })
      .expect(201)
      .expect((response) => {
        const body = response.body as { sessionId: string };
        expect(body.sessionId).toBe(reservation.stripeSessionId);
      });
    expect(provider.checkoutInputs).toHaveLength(checkoutCount);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/billing/checkout-session`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ interval: BillingInterval.MONTHLY })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/billing/portal-session`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(201)
      .expect({ url: 'https://billing.stripe.test/portal' });
    expect(provider.portalReturnUrls.at(-1)).toBe(
      'http://localhost:5173/billing',
    );
  });

  it('synchronizes lifecycle events, rejects replay, and protects event order', async () => {
    const subscriptionId = `sub_${marker}`;
    const now = new Date();
    provider.subscriptions.set(
      subscriptionId,
      subscription(subscriptionId, SubscriptionStatus.TRIALING),
    );

    const trialEvent = webhookEvent(
      'customer.subscription.created',
      'subscription_changed',
      now,
      { subscription: provider.subscriptions.get(subscriptionId)! },
    );
    await sendEvent(trialEvent);
    await sendEvent(trialEvent);

    await expect(
      prisma.processedStripeEvent.count({ where: { id: trialEvent.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.notification.count({
        where: {
          userId: ownerId,
          type: NotificationType.BILLING_TRIAL_STARTED,
        },
      }),
    ).resolves.toBe(1);
    const customer = await prisma.stripeCustomer.findUniqueOrThrow({
      where: { organizationId },
    });
    expect(customer.trialUsedAt).toBeInstanceOf(Date);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/billing`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          hasPaidAccess: boolean;
          plan: { code: PlanCode };
        };
        expect(body.hasPaidAccess).toBe(true);
        expect(body.plan.code).toBe(PlanCode.PRO);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/billing/checkout-session`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ interval: BillingInterval.MONTHLY })
      .expect(409);

    provider.subscriptions.set(subscriptionId, {
      ...subscription(subscriptionId, SubscriptionStatus.TRIALING),
      cancelAtPeriodEnd: true,
    });
    const cancellationEvent = webhookEvent(
      'customer.subscription.updated',
      'subscription_changed',
      new Date(now.getTime() + 30_000),
      { subscription: provider.subscriptions.get(subscriptionId)! },
    );
    await sendEvent(cancellationEvent);
    await expect(
      prisma.notification.count({
        where: {
          userId: ownerId,
          type: NotificationType.BILLING_CANCELLATION_SCHEDULED,
        },
      }),
    ).resolves.toBe(1);

    provider.subscriptions.set(
      subscriptionId,
      subscription(subscriptionId, SubscriptionStatus.PAST_DUE),
    );
    const failedEvent = webhookEvent(
      'invoice.payment_failed',
      'invoice_changed',
      new Date(now.getTime() + 60_000),
      { invoiceId: `in_${marker}`, subscriptionId },
    );
    await sendEvent(failedEvent);
    const pastDue = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId },
    });
    expect(pastDue.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(pastDue.gracePeriodEndsAt?.getTime()).toBeGreaterThan(Date.now());
    await expect(
      prisma.notification.count({
        where: {
          userId: ownerId,
          type: {
            in: [
              NotificationType.BILLING_PAYMENT_FAILED,
              NotificationType.BILLING_GRACE_PERIOD_STARTED,
            ],
          },
        },
      }),
    ).resolves.toBe(2);

    provider.subscriptions.set(
      subscriptionId,
      subscription(subscriptionId, SubscriptionStatus.CANCELED),
    );
    const olderEvent = webhookEvent(
      'customer.subscription.deleted',
      'subscription_changed',
      new Date(now.getTime() - 60_000),
      { subscription: provider.subscriptions.get(subscriptionId)! },
    );
    await sendEvent(olderEvent);
    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { organizationId } }),
    ).resolves.toEqual(
      expect.objectContaining({ status: SubscriptionStatus.PAST_DUE }),
    );
  });

  it('keeps partial refunds and immediately removes access for full refunds', async () => {
    const localSubscription = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId },
    });
    provider.chargeSubscriptionId = localSubscription.stripeSubscriptionId;
    provider.subscriptions.set(
      localSubscription.stripeSubscriptionId,
      subscription(
        localSubscription.stripeSubscriptionId,
        SubscriptionStatus.ACTIVE,
      ),
    );

    const partial = webhookEvent(
      'charge.refunded',
      'charge_refunded',
      new Date(Date.now() + 120_000),
      { chargeId: `ch_partial_${marker}`, fullyRefunded: false },
    );
    await sendEvent(partial);
    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { organizationId } }),
    ).resolves.toEqual(
      expect.objectContaining({ status: SubscriptionStatus.PAST_DUE }),
    );

    const full = webhookEvent(
      'charge.refunded',
      'charge_refunded',
      new Date(Date.now() + 180_000),
      { chargeId: `ch_full_${marker}`, fullyRefunded: true },
    );
    await sendEvent(full);
    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { organizationId } }),
    ).resolves.toEqual(
      expect.objectContaining({ status: SubscriptionStatus.CANCELED }),
    );
    await expect(
      prisma.notification.count({
        where: {
          userId: ownerId,
          type: NotificationType.BILLING_FULL_REFUND,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.notification.count({
        where: {
          userId: ownerId,
          type: NotificationType.BILLING_SUBSCRIPTION_CANCELED,
        },
      }),
    ).resolves.toBe(0);

    const dispute = webhookEvent(
      'charge.dispute.created',
      'charge_disputed',
      new Date(Date.now() + 210_000),
      { chargeId: `ch_dispute_${marker}` },
    );
    await sendEvent(dispute);
    await expect(
      prisma.notification.count({
        where: { userId: ownerId, type: NotificationType.BILLING_DISPUTE },
      }),
    ).resolves.toBe(1);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/billing`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          hasPaidAccess: boolean;
          plan: { code: PlanCode };
        };
        expect(body.hasPaidAccess).toBe(false);
        expect(body.plan.code).toBe(PlanCode.FREE);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/billing/checkout-session`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ interval: BillingInterval.MONTHLY })
      .expect(201);
    expect(provider.checkoutInputs.at(-1)).toEqual(
      expect.objectContaining({ trialDays: undefined }),
    );
  });

  it('rejects invalid webhooks and publishes the billing API contract', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'invalid')
      .send({})
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect((response) => {
        const document = response.body as {
          components: {
            schemas: Record<
              string,
              {
                properties?: Record<string, { format?: string }>;
                required?: string[];
              }
            >;
          };
          paths: Record<string, unknown>;
        };
        const paths = document.paths;
        expect(Object.keys(paths)).toEqual(
          expect.arrayContaining([
            '/api/v1/billing/plans',
            '/api/v1/organizations/{organizationId}/billing',
            '/api/v1/organizations/{organizationId}/billing/checkout-session',
            '/api/v1/organizations/{organizationId}/billing/portal-session',
          ]),
        );
        expect(paths).not.toHaveProperty('/api/v1/webhooks/stripe');
        const checkout = paths[
          '/api/v1/organizations/{organizationId}/billing/checkout-session'
        ] as {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: string };
                };
              };
            };
          };
        };
        expect(
          checkout.post.requestBody.content['application/json'].schema.$ref,
        ).toBe('#/components/schemas/CreateCheckoutSessionDto');
        expect(
          document.components.schemas.CreateCheckoutSessionDto.required,
        ).toContain('interval');
        expect(
          document.components.schemas.BillingStateResponseDto.properties
            ?.currentPeriodEnd?.format,
        ).toBe('date-time');
      });
  });

  it('leaves failed webhook events unrecorded so Stripe can retry them', async () => {
    const missingSubscriptionId = `sub_missing_${marker}`;
    const event = webhookEvent(
      'invoice.payment_failed',
      'invoice_changed',
      new Date(Date.now() + 240_000),
      {
        invoiceId: `in_missing_${marker}`,
        subscriptionId: missingSubscriptionId,
      },
    );
    provider.nextEvent = event;

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'valid')
      .send({ eventId: event.id })
      .expect(500);
    await expect(
      prisma.processedStripeEvent.count({ where: { id: event.id } }),
    ).resolves.toBe(0);
  });

  afterAll(async () => {
    await prisma.processedStripeEvent.deleteMany({
      where: { id: { in: eventIds } },
    });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({
      where: { email: { contains: marker } },
    });
    await app.close();
  });

  function subscription(
    id: string,
    status: SubscriptionStatus,
  ): ProviderSubscription {
    const periodStart = new Date();
    return {
      id,
      customerId: `cus_test_${organizationId}`,
      organizationId,
      productId: 'prod_local_pro',
      priceId: 'price_local_pro_monthly',
      interval: BillingInterval.MONTHLY,
      status,
      automaticTaxEnabled: false,
      cancelAtPeriodEnd: false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: new Date(
        periodStart.getTime() + 30 * 24 * 60 * 60 * 1000,
      ),
      trialStart: status === SubscriptionStatus.TRIALING ? periodStart : null,
      trialEnd:
        status === SubscriptionStatus.TRIALING
          ? new Date(periodStart.getTime() + 14 * 24 * 60 * 60 * 1000)
          : null,
      canceledAt: status === SubscriptionStatus.CANCELED ? new Date() : null,
      endedAt: status === SubscriptionStatus.CANCELED ? new Date() : null,
      latestInvoiceId: `in_${marker}`,
    };
  }

  function webhookEvent<K extends BillingWebhookEvent['kind']>(
    type: string,
    kind: K,
    createdAt: Date,
    detail: Omit<
      Extract<BillingWebhookEvent, { kind: K }>,
      'id' | 'type' | 'kind' | 'createdAt' | 'providerObjectId'
    >,
  ): Extract<BillingWebhookEvent, { kind: K }> {
    const id = `evt_${randomUUID()}`;
    eventIds.push(id);
    return {
      id,
      type,
      kind,
      createdAt,
      providerObjectId: `${kind}_${marker}`,
      ...detail,
    } as Extract<BillingWebhookEvent, { kind: K }>;
  }

  async function sendEvent(event: BillingWebhookEvent): Promise<void> {
    provider.nextEvent = event;
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'valid')
      .send({ eventId: event.id })
      .expect(204);
  }
});
