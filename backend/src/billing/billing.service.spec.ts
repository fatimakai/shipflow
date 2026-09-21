import type { ConfigService } from '@nestjs/config';
import type { OrganizationContext } from '../authorization/organization-context.service';
import type { EnvironmentVariables } from '../config/env.validation';
import type { PrismaService } from '../database/prisma.service';
import { BillingInterval, MembershipRole } from '../generated/prisma/enums';
import type { BillingEntitlementService } from './billing-entitlement.service';
import { BillingService } from './billing.service';
import type { BillingProvider } from './billing.types';

describe('BillingService checkout reservations', () => {
  const organizationId = '2b79506f-2c3c-4785-bd5e-e226e029fb64';
  const context = {
    membershipId: '8558e666-aabe-41cf-84ef-d32fb7bf6993',
    role: MembershipRole.OWNER,
    organization: {
      id: organizationId,
      name: 'Demo organization',
      slug: 'demo-organization',
      ownerId: 'ddf5d975-d40d-474a-b7d8-2a68917ebf21',
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      updatedAt: new Date('2030-01-01T00:00:00.000Z'),
      deletedAt: null,
      owner: {
        id: 'ddf5d975-d40d-474a-b7d8-2a68917ebf21',
        email: 'owner@example.com',
        displayName: 'Owner',
        avatarUrl: null,
      },
      _count: { memberships: 1 },
    },
  } satisfies OrganizationContext;

  it('releases an empty reservation when the provider rejects Checkout creation', async () => {
    let reservation: {
      id: string;
      organizationId: string;
      requestKey: string;
      interval: BillingInterval;
      stripeSessionId: string | null;
      checkoutUrl: string | null;
      expiresAt: Date;
      createdAt: Date;
    } | null = null;
    let reservationSequence = 0;
    const billingCheckoutSession = {
      findUnique: jest.fn(() => Promise.resolve(reservation)),
      create: jest.fn(
        ({
          data,
        }: {
          data: { interval: BillingInterval; requestKey: string };
        }) => {
          reservationSequence += 1;
          reservation = {
            id: `reservation-${reservationSequence}`,
            organizationId,
            requestKey: data.requestKey,
            interval: data.interval,
            stripeSessionId: null,
            checkoutUrl: null,
            expiresAt: new Date(Date.now() + 86_400_000),
            createdAt: new Date(),
          };
          return Promise.resolve(reservation);
        },
      ),
      deleteMany: jest.fn(() => {
        reservation = null;
        return Promise.resolve({ count: 1 });
      }),
      upsert: jest.fn(({ create }) => Promise.resolve(create)),
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(null) },
      stripeCustomer: {
        findUnique: jest.fn().mockResolvedValue({
          organizationId,
          stripeCustomerId: 'cus_test',
          trialUsedAt: null,
        }),
      },
      billingCheckoutSession,
    };
    const provider = {
      createCheckoutSession: jest
        .fn()
        .mockRejectedValueOnce(new Error('Stripe rejected the request'))
        .mockResolvedValueOnce({
          sessionId: 'cs_test_monthly',
          url: 'https://checkout.stripe.test/session',
          expiresAt: new Date('2030-01-02T00:00:00.000Z'),
        }),
    };
    const values: Partial<EnvironmentVariables> = {
      BILLING_TRIAL_DAYS: 14,
      FRONTEND_URL: 'https://shipflow.pages.dev',
      STRIPE_AUTOMATIC_TAX_ENABLED: true,
      STRIPE_PRO_ANNUAL_PRICE_ID: 'price_annual',
      STRIPE_PRO_MONTHLY_PRICE_ID: 'price_monthly',
    };
    const config = {
      getOrThrow: jest.fn((key: keyof EnvironmentVariables) => values[key]),
    };
    const service = new BillingService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<EnvironmentVariables, true>,
      {} as BillingEntitlementService,
      provider as unknown as BillingProvider,
    );

    await expect(
      service.createCheckoutSession(context, BillingInterval.ANNUAL),
    ).rejects.toThrow('Stripe rejected the request');

    const deletion = billingCheckoutSession.deleteMany.mock.calls[0]?.[0] as {
      where: {
        id: string;
        requestKey: string;
        stripeSessionId: string | null;
      };
    };
    expect(deletion.where.id).toBe('reservation-1');
    expect(typeof deletion.where.requestKey).toBe('string');
    expect(deletion.where.stripeSessionId).toBeNull();

    await expect(
      service.createCheckoutSession(context, BillingInterval.MONTHLY),
    ).resolves.toEqual(
      expect.objectContaining({ sessionId: 'cs_test_monthly' }),
    );
    const checkoutCalls = provider.createCheckoutSession.mock
      .calls as unknown as Array<
      [{ interval: BillingInterval; priceId: string }, idempotencyKey: string]
    >;
    const [input, idempotencyKey] = checkoutCalls.at(-1)!;
    expect(input.interval).toBe(BillingInterval.MONTHLY);
    expect(input.priceId).toBe('price_monthly');
    expect(typeof idempotencyKey).toBe('string');
  });

  it('replaces a stale unfinished reservation for another interval', async () => {
    const staleReservation = {
      id: 'stale-reservation',
      organizationId,
      requestKey: '094e6882-9f95-48fc-bef2-e54daea7fd08',
      interval: BillingInterval.ANNUAL,
      stripeSessionId: null,
      checkoutUrl: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    };
    const replacement = {
      ...staleReservation,
      id: 'replacement-reservation',
      requestKey: '5a08187d-772a-4711-99cf-8c609e26a30a',
      interval: BillingInterval.MONTHLY,
      createdAt: new Date(),
    };
    const billingCheckoutSession = {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce(staleReservation)
        .mockResolvedValueOnce(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue(replacement),
    };
    const service = new BillingService(
      { billingCheckoutSession } as unknown as PrismaService,
      {} as ConfigService<EnvironmentVariables, true>,
      {} as BillingEntitlementService,
      {} as BillingProvider,
    );
    const checkoutReservationService = service as unknown as {
      reserveCheckout: (
        requestedOrganizationId: string,
        interval: BillingInterval,
      ) => Promise<typeof replacement>;
    };

    await expect(
      checkoutReservationService.reserveCheckout(
        organizationId,
        BillingInterval.MONTHLY,
      ),
    ).resolves.toEqual(replacement);

    expect(billingCheckoutSession.deleteMany).toHaveBeenCalledTimes(1);
    const creationCalls = billingCheckoutSession.create.mock
      .calls as unknown as Array<
      [{ data: { organizationId: string; interval: BillingInterval } }]
    >;
    const creation = creationCalls[0][0];
    expect(creation.data.organizationId).toBe(organizationId);
    expect(creation.data.interval).toBe(BillingInterval.MONTHLY);
  });
});
