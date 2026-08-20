import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import {
  BillingInterval,
  NotificationCategory,
  NotificationType,
  PlanCode,
  SubscriptionStatus,
} from '../generated/prisma/enums';
import {
  InjectBillingProvider,
  type BillingProvider,
  type BillingWebhookEvent,
  type ProviderSubscription,
} from './billing.types';
import { writeNotification } from '../notifications/notification.writer';

type BillingNotificationCause = 'full_refund' | 'dispute';

interface SubscriptionSyncContext {
  eventId: string;
  cause?: BillingNotificationCause;
}

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    @InjectBillingProvider() private readonly provider: BillingProvider,
  ) {}

  async process(rawBody: Buffer, signature: string): Promise<void> {
    let event: BillingWebhookEvent;
    try {
      event = this.provider.verifyWebhook(rawBody, signature);
    } catch {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    const processed = await this.prisma.processedStripeEvent.findUnique({
      where: { id: event.id },
      select: { id: true },
    });
    if (processed) {
      return;
    }

    await this.processEvent(event);
    try {
      await this.prisma.processedStripeEvent.create({
        data: {
          id: event.id,
          eventType: event.type,
          providerObjectId: event.providerObjectId,
          eventCreatedAt: event.createdAt,
        },
      });
    } catch (error: unknown) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  private async processEvent(event: BillingWebhookEvent): Promise<void> {
    switch (event.kind) {
      case 'checkout_completed':
        await this.processCheckout(event);
        return;
      case 'subscription_changed':
        await this.syncSubscription(
          await this.provider.retrieveSubscription(event.subscription.id),
          event.createdAt,
          { eventId: event.id },
        );
        return;
      case 'invoice_changed':
        if (event.subscriptionId) {
          await this.syncSubscription(
            await this.provider.retrieveSubscription(event.subscriptionId),
            event.createdAt,
            { eventId: event.id },
          );
        }
        return;
      case 'charge_refunded':
        if (event.fullyRefunded) {
          await this.cancelForCharge(
            event.chargeId,
            event.createdAt,
            event.id,
            'full_refund',
          );
        }
        return;
      case 'charge_disputed':
        if (event.chargeId) {
          await this.cancelForCharge(
            event.chargeId,
            event.createdAt,
            event.id,
            'dispute',
          );
        }
        return;
      case 'unsupported':
        return;
    }
  }

  private async processCheckout(
    event: Extract<BillingWebhookEvent, { kind: 'checkout_completed' }>,
  ): Promise<void> {
    await this.prisma.billingCheckoutSession.deleteMany({
      where: { stripeSessionId: event.sessionId },
    });
    if (event.organizationId) {
      await this.prisma.stripeCustomer.upsert({
        where: { organizationId: event.organizationId },
        create: {
          organizationId: event.organizationId,
          stripeCustomerId: event.customerId,
        },
        update: { stripeCustomerId: event.customerId },
      });
    }
    if (event.subscriptionId) {
      await this.syncSubscription(
        await this.provider.retrieveSubscription(event.subscriptionId),
        event.createdAt,
        { eventId: event.id },
      );
    }
  }

  private async cancelForCharge(
    chargeId: string,
    eventCreatedAt: Date,
    eventId: string,
    cause: BillingNotificationCause,
  ): Promise<void> {
    const subscriptionId =
      await this.provider.resolveSubscriptionForCharge(chargeId);
    if (!subscriptionId) {
      return;
    }
    await this.syncSubscription(
      await this.provider.cancelSubscriptionNow(subscriptionId),
      eventCreatedAt,
      { eventId, cause },
    );
  }

  private async syncSubscription(
    providerSubscription: ProviderSubscription,
    eventCreatedAt: Date,
    syncContext: SubscriptionSyncContext,
  ): Promise<void> {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { stripeCustomerId: providerSubscription.customerId },
      select: { organizationId: true },
    });
    const organizationId =
      providerSubscription.organizationId ?? customer?.organizationId;
    if (!organizationId) {
      this.logger.warn(
        `Ignoring Stripe subscription ${providerSubscription.id} without an organization`,
      );
      return;
    }

    if (
      providerSubscription.productId !==
      this.configService.getOrThrow<string>('STRIPE_PRO_PRODUCT_ID')
    ) {
      this.logger.warn(
        `Ignoring Stripe subscription ${providerSubscription.id} with an unknown product`,
      );
      return;
    }

    const interval = this.intervalForPrice(providerSubscription.priceId);
    if (!interval) {
      this.logger.warn(
        `Ignoring Stripe subscription ${providerSubscription.id} with an unknown price`,
      );
      return;
    }

    const [plan, existing] = await Promise.all([
      this.prisma.plan.findUniqueOrThrow({ where: { code: PlanCode.PRO } }),
      this.prisma.subscription.findUnique({ where: { organizationId } }),
    ]);
    if (
      existing &&
      existing.lastStripeEventCreatedAt.getTime() >= eventCreatedAt.getTime()
    ) {
      if (syncContext.cause) {
        await this.writeBillingCause(
          organizationId,
          syncContext,
          eventCreatedAt,
        );
      }
      return;
    }

    const gracePeriodEndsAt =
      providerSubscription.status === SubscriptionStatus.PAST_DUE
        ? (existing?.gracePeriodEndsAt ??
          new Date(
            eventCreatedAt.getTime() +
              this.configService.getOrThrow<number>(
                'BILLING_GRACE_PERIOD_DAYS',
              ) *
                24 *
                60 *
                60 *
                1000,
          ))
        : null;
    const data = {
      planId: plan.id,
      stripeSubscriptionId: providerSubscription.id,
      stripePriceId: providerSubscription.priceId,
      stripeLatestInvoiceId: providerSubscription.latestInvoiceId,
      interval,
      status: providerSubscription.status,
      automaticTaxEnabled: providerSubscription.automaticTaxEnabled,
      cancelAtPeriodEnd: providerSubscription.cancelAtPeriodEnd,
      currentPeriodStart: providerSubscription.currentPeriodStart,
      currentPeriodEnd: providerSubscription.currentPeriodEnd,
      trialStart: providerSubscription.trialStart,
      trialEnd: providerSubscription.trialEnd,
      gracePeriodEndsAt,
      canceledAt: providerSubscription.canceledAt,
      endedAt: providerSubscription.endedAt,
      lastStripeEventCreatedAt: eventCreatedAt,
    };

    await this.prisma.$transaction(async (transaction) => {
      await transaction.billingCheckoutSession.deleteMany({
        where: { organizationId },
      });
      await transaction.stripeCustomer.upsert({
        where: { organizationId },
        create: {
          organizationId,
          stripeCustomerId: providerSubscription.customerId,
          trialUsedAt: providerSubscription.trialStart ? eventCreatedAt : null,
        },
        update: {
          stripeCustomerId: providerSubscription.customerId,
        },
      });
      if (providerSubscription.trialStart) {
        await transaction.stripeCustomer.updateMany({
          where: { organizationId, trialUsedAt: null },
          data: { trialUsedAt: eventCreatedAt },
        });
      }
      await transaction.subscription.upsert({
        where: { organizationId },
        create: { organizationId, ...data },
        update: data,
      });
      const organization = await transaction.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true, ownerId: true },
      });
      const common = {
        userId: organization.ownerId,
        organizationId,
        category: NotificationCategory.BILLING,
        actionPath: '/billing',
        createdAt: eventCreatedAt,
      } as const;
      const write = (
        type: NotificationType,
        title: string,
        message: string,
        metadata: Record<string, string | null>,
      ) =>
        writeNotification(transaction, {
          ...common,
          type,
          title,
          message,
          metadata,
          dedupeKey: `stripe:${syncContext.eventId}:${type}`,
        });

      if (syncContext.cause === 'full_refund') {
        await write(
          NotificationType.BILLING_FULL_REFUND,
          'Subscription refunded',
          `The current Pro subscription for ${organization.name} was fully refunded and canceled.`,
          { subscriptionId: providerSubscription.id },
        );
      } else if (syncContext.cause === 'dispute') {
        await write(
          NotificationType.BILLING_DISPUTE,
          'Payment disputed',
          `A payment for ${organization.name} was disputed and Pro access was removed.`,
          { subscriptionId: providerSubscription.id },
        );
      } else if (
        providerSubscription.status === SubscriptionStatus.CANCELED &&
        existing?.status !== SubscriptionStatus.CANCELED
      ) {
        await write(
          NotificationType.BILLING_SUBSCRIPTION_CANCELED,
          'Subscription canceled',
          `The Pro subscription for ${organization.name} was canceled.`,
          { subscriptionId: providerSubscription.id },
        );
      }

      if (
        providerSubscription.status === SubscriptionStatus.TRIALING &&
        existing?.status !== SubscriptionStatus.TRIALING
      ) {
        await write(
          NotificationType.BILLING_TRIAL_STARTED,
          'Pro trial started',
          `The Pro trial for ${organization.name} has started.`,
          {
            subscriptionId: providerSubscription.id,
            trialEnd: providerSubscription.trialEnd?.toISOString() ?? null,
          },
        );
      }
      if (
        providerSubscription.status === SubscriptionStatus.PAST_DUE &&
        existing?.status !== SubscriptionStatus.PAST_DUE
      ) {
        await write(
          NotificationType.BILLING_PAYMENT_FAILED,
          'Subscription payment failed',
          `A payment for ${organization.name} failed. Pro access remains available during the grace period.`,
          {
            subscriptionId: providerSubscription.id,
            gracePeriodEndsAt: gracePeriodEndsAt?.toISOString() ?? null,
          },
        );
        await write(
          NotificationType.BILLING_GRACE_PERIOD_STARTED,
          'Payment grace period started',
          `The seven-day payment grace period for ${organization.name} has started.`,
          {
            subscriptionId: providerSubscription.id,
            gracePeriodEndsAt: gracePeriodEndsAt?.toISOString() ?? null,
          },
        );
      }
      if (
        providerSubscription.cancelAtPeriodEnd &&
        !existing?.cancelAtPeriodEnd
      ) {
        await write(
          NotificationType.BILLING_CANCELLATION_SCHEDULED,
          'Subscription cancellation scheduled',
          `The Pro subscription for ${organization.name} will end after the current billing period.`,
          {
            subscriptionId: providerSubscription.id,
            currentPeriodEnd:
              providerSubscription.currentPeriodEnd.toISOString(),
          },
        );
      }
    });
  }

  private async writeBillingCause(
    organizationId: string,
    syncContext: SubscriptionSyncContext,
    createdAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true, ownerId: true },
      });
      const type =
        syncContext.cause === 'full_refund'
          ? NotificationType.BILLING_FULL_REFUND
          : NotificationType.BILLING_DISPUTE;
      await writeNotification(transaction, {
        userId: organization.ownerId,
        organizationId,
        category: NotificationCategory.BILLING,
        type,
        title:
          syncContext.cause === 'full_refund'
            ? 'Subscription refunded'
            : 'Payment disputed',
        message:
          syncContext.cause === 'full_refund'
            ? `The current Pro subscription for ${organization.name} was fully refunded and canceled.`
            : `A payment for ${organization.name} was disputed and Pro access was removed.`,
        actionPath: '/billing',
        dedupeKey: `stripe:${syncContext.eventId}:${type}`,
        createdAt,
      });
    });
  }

  private intervalForPrice(priceId: string): BillingInterval | undefined {
    if (
      priceId ===
      this.configService.getOrThrow<string>('STRIPE_PRO_MONTHLY_PRICE_ID')
    ) {
      return BillingInterval.MONTHLY;
    }
    if (
      priceId ===
      this.configService.getOrThrow<string>('STRIPE_PRO_ANNUAL_PRICE_ID')
    ) {
      return BillingInterval.ANNUAL;
    }
    return undefined;
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
