import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrganizationContext } from '../authorization/organization-context.service';
import type { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import { BillingInterval, SubscriptionStatus } from '../generated/prisma/enums';
import { BillingEntitlementService } from './billing-entitlement.service';
import { InjectBillingProvider, type BillingProvider } from './billing.types';
import type {
  BillingPlanListResponseDto,
  BillingStateResponseDto,
  CheckoutSessionResponseDto,
  PortalSessionResponseDto,
} from './dto/billing-response.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly entitlements: BillingEntitlementService,
    @InjectBillingProvider() private readonly provider: BillingProvider,
  ) {}

  async listPlans(): Promise<BillingPlanListResponseDto> {
    const plans = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { monthlyPriceCents: 'asc' },
    });
    return {
      items: plans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        currency: plan.currency,
        monthlyPriceCents: plan.monthlyPriceCents,
        annualPriceCents: plan.annualPriceCents,
        features: plan.features,
      })),
    };
  }

  getBillingState(organizationId: string): Promise<BillingStateResponseDto> {
    return this.entitlements.getSnapshot(organizationId);
  }

  async createCheckoutSession(
    context: OrganizationContext,
    interval: BillingInterval,
  ): Promise<CheckoutSessionResponseDto> {
    const existingSubscription = await this.prisma.subscription.findUnique({
      where: { organizationId: context.organization.id },
      select: { status: true },
    });
    if (
      existingSubscription &&
      this.isManagedSubscription(existingSubscription.status)
    ) {
      throw new ConflictException(
        'This organization already has a subscription; use the billing portal',
      );
    }

    const customer = await this.ensureCustomer(context);
    const reservation = await this.reserveCheckout(
      context.organization.id,
      interval,
    );
    if (reservation.stripeSessionId && reservation.checkoutUrl) {
      return {
        sessionId: reservation.stripeSessionId,
        url: reservation.checkoutUrl,
        expiresAt: reservation.expiresAt,
      };
    }
    const priceId = this.priceId(interval);
    const trialDays = customer.trialUsedAt
      ? undefined
      : this.configService.getOrThrow<number>('BILLING_TRIAL_DAYS');
    const frontendUrl = this.frontendUrl();
    const session = await this.provider.createCheckoutSession(
      {
        customerId: customer.stripeCustomerId,
        organizationId: context.organization.id,
        interval,
        priceId,
        trialDays,
        automaticTaxEnabled: this.configService.getOrThrow<boolean>(
          'STRIPE_AUTOMATIC_TAX_ENABLED',
        ),
        successUrl: `${frontendUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${frontendUrl}/billing?checkout=canceled`,
      },
      reservation.requestKey,
    );
    const expiresAt =
      session.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.billingCheckoutSession.upsert({
      where: { requestKey: reservation.requestKey },
      create: {
        organizationId: context.organization.id,
        requestKey: reservation.requestKey,
        interval,
        stripeSessionId: session.sessionId,
        checkoutUrl: session.url,
        expiresAt,
      },
      update: {
        stripeSessionId: session.sessionId,
        checkoutUrl: session.url,
        expiresAt,
      },
    });
    return session;
  }

  async createPortalSession(
    organizationId: string,
  ): Promise<PortalSessionResponseDto> {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { organizationId },
    });
    if (!customer) {
      throw new NotFoundException(
        'No billing customer exists for this organization',
      );
    }
    return this.provider.createPortalSession(
      customer.stripeCustomerId,
      `${this.frontendUrl()}/billing`,
    );
  }

  private async ensureCustomer(context: OrganizationContext) {
    const existing = await this.prisma.stripeCustomer.findUnique({
      where: { organizationId: context.organization.id },
    });
    if (existing) {
      return existing;
    }

    const created = await this.provider.createCustomer(
      {
        organizationId: context.organization.id,
        organizationName: context.organization.name,
        ownerEmail: context.organization.owner.email,
      },
      `customer:${context.organization.id}`,
    );
    return this.prisma.stripeCustomer.upsert({
      where: { organizationId: context.organization.id },
      create: {
        organizationId: context.organization.id,
        stripeCustomerId: created.customerId,
      },
      update: {},
    });
  }

  private async reserveCheckout(
    organizationId: string,
    interval: BillingInterval,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const now = new Date();
      const existing = await this.prisma.billingCheckoutSession.findUnique({
        where: { organizationId },
      });
      if (existing && existing.expiresAt.getTime() > now.getTime()) {
        if (existing.interval !== interval) {
          throw new ConflictException(
            'A Checkout session for another billing interval is still open',
          );
        }
        return existing;
      }
      if (existing) {
        await this.prisma.billingCheckoutSession.deleteMany({
          where: { id: existing.id, expiresAt: { lte: now } },
        });
      }

      try {
        return await this.prisma.billingCheckoutSession.create({
          data: {
            organizationId,
            requestKey: randomUUID(),
            interval,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        });
      } catch (error: unknown) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }
    throw new ConflictException('A Checkout session is already being created');
  }

  private isManagedSubscription(status: SubscriptionStatus): boolean {
    return new Set<SubscriptionStatus>([
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
      SubscriptionStatus.PAST_DUE,
      SubscriptionStatus.INCOMPLETE,
    ]).has(status);
  }

  private priceId(interval: BillingInterval): string {
    return interval === BillingInterval.ANNUAL
      ? this.configService.getOrThrow<string>('STRIPE_PRO_ANNUAL_PRICE_ID')
      : this.configService.getOrThrow<string>('STRIPE_PRO_MONTHLY_PRICE_ID');
  }

  private frontendUrl(): string {
    return this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
