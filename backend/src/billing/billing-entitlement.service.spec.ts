import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import {
  BillingInterval,
  PlanCode,
  SubscriptionStatus,
} from '../generated/prisma/enums';
import { BillingEntitlementService } from './billing-entitlement.service';

const freePlan = {
  code: PlanCode.FREE,
  name: 'Free',
  description: 'Core organization features',
  currency: 'usd',
  monthlyPriceCents: 0,
  annualPriceCents: 0,
  features: ['core'],
};
const proPlan = {
  code: PlanCode.PRO,
  name: 'Pro',
  description: 'All Pro organization features',
  currency: 'usd',
  monthlyPriceCents: 2900,
  annualPriceCents: 29000,
  features: ['core', 'pro'],
};

describe('BillingEntitlementService', () => {
  const prisma = {
    plan: { findUniqueOrThrow: jest.fn() },
    subscription: { findUnique: jest.fn() },
  };
  const service = new BillingEntitlementService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.plan.findUniqueOrThrow.mockResolvedValue(freePlan);
  });

  it.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])(
    'grants Pro entitlements for %s subscriptions',
    async (status) => {
      prisma.subscription.findUnique.mockResolvedValue(
        subscription(status, null),
      );

      const snapshot = await service.getSnapshot('org-id');
      expect(snapshot.plan.code).toBe(PlanCode.PRO);
      expect(snapshot.hasPaidAccess).toBe(true);
      await expect(service.hasFeature('org-id', 'pro')).resolves.toBe(true);
    },
  );

  it('keeps Pro during the failed-payment grace period', async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subscription(SubscriptionStatus.PAST_DUE, new Date(Date.now() + 60_000)),
    );

    await expect(service.getSnapshot('org-id')).resolves.toEqual(
      expect.objectContaining({ hasPaidAccess: true }),
    );
  });

  it.each([
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.UNPAID,
    SubscriptionStatus.INCOMPLETE,
    SubscriptionStatus.INCOMPLETE_EXPIRED,
    SubscriptionStatus.PAUSED,
  ])('falls back to Free for %s subscriptions', async (status) => {
    prisma.subscription.findUnique.mockResolvedValue(
      subscription(status, null),
    );

    const snapshot = await service.getSnapshot('org-id');
    expect(snapshot.plan.code).toBe(PlanCode.FREE);
    expect(snapshot.hasPaidAccess).toBe(false);
  });

  it('removes Pro after the failed-payment grace period expires', async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subscription(SubscriptionStatus.PAST_DUE, new Date(Date.now() - 60_000)),
    );

    await expect(service.assertFeature('org-id', 'pro')).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});

function subscription(
  status: SubscriptionStatus,
  gracePeriodEndsAt: Date | null,
) {
  return {
    status,
    gracePeriodEndsAt,
    interval: BillingInterval.MONTHLY,
    currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
    trialEnd: null,
    cancelAtPeriodEnd: false,
    plan: proPlan,
  };
}
