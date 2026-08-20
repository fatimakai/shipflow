import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlanCode, SubscriptionStatus } from '../generated/prisma/enums';
import type { BillingStateResponseDto } from './dto/billing-response.dto';

@Injectable()
export class BillingEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(organizationId: string): Promise<BillingStateResponseDto> {
    const [freePlan, subscription] = await Promise.all([
      this.prisma.plan.findUniqueOrThrow({ where: { code: PlanCode.FREE } }),
      this.prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true },
      }),
    ]);
    const hasPaidAccess = this.hasPaidAccess(subscription);
    const plan = hasPaidAccess && subscription ? subscription.plan : freePlan;

    return {
      plan: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        currency: plan.currency,
        monthlyPriceCents: plan.monthlyPriceCents,
        annualPriceCents: plan.annualPriceCents,
        features: plan.features,
      },
      subscriptionStatus: subscription?.status ?? null,
      interval: subscription?.interval ?? null,
      hasPaidAccess,
      currentPeriodStart: subscription?.currentPeriodStart ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      trialEnd: subscription?.trialEnd ?? null,
      gracePeriodEndsAt: subscription?.gracePeriodEndsAt ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    };
  }

  async hasFeature(organizationId: string, feature: string): Promise<boolean> {
    const snapshot = await this.getSnapshot(organizationId);
    return snapshot.plan.features.includes(feature);
  }

  async assertFeature(organizationId: string, feature: string): Promise<void> {
    if (!(await this.hasFeature(organizationId, feature))) {
      throw new HttpException(
        `The ${feature} feature requires a plan upgrade`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private hasPaidAccess(
    subscription: {
      status: SubscriptionStatus;
      gracePeriodEndsAt: Date | null;
    } | null,
  ): boolean {
    if (!subscription) {
      return false;
    }
    if (
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.TRIALING
    ) {
      return true;
    }
    return (
      subscription.status === SubscriptionStatus.PAST_DUE &&
      subscription.gracePeriodEndsAt !== null &&
      subscription.gracePeriodEndsAt.getTime() > Date.now()
    );
  }
}
