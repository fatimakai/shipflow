import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { EnvironmentVariables } from '../config/env.validation';
import { BillingInterval, SubscriptionStatus } from '../generated/prisma/enums';
import type {
  BillingProvider,
  BillingWebhookEvent,
  ProviderCheckoutSession,
  ProviderCustomer,
  ProviderPortalSession,
  ProviderSubscription,
} from './billing.types';

export class StubBillingProvider implements BillingProvider {
  readonly name = 'stub' as const;

  createCustomer(input: { organizationId: string }): Promise<ProviderCustomer> {
    return Promise.resolve({
      customerId: `cus_stub_${input.organizationId.replaceAll('-', '')}`,
    });
  }

  createCheckoutSession(input: {
    successUrl: string;
  }): Promise<ProviderCheckoutSession> {
    const sessionId = `cs_stub_${randomUUID().replaceAll('-', '')}`;
    const separator = input.successUrl.includes('?') ? '&' : '?';
    return Promise.resolve({
      sessionId,
      url: `${input.successUrl}${separator}stub_session_id=${sessionId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  }

  createPortalSession(
    _customerId: string,
    returnUrl: string,
  ): Promise<ProviderPortalSession> {
    return Promise.resolve({ url: returnUrl });
  }

  verifyWebhook(): BillingWebhookEvent {
    throw new Error('Stripe webhook verification is unavailable');
  }

  retrieveSubscription(): Promise<ProviderSubscription> {
    return Promise.reject(new Error('Stripe subscriptions are unavailable'));
  }

  cancelSubscriptionNow(): Promise<ProviderSubscription> {
    return Promise.reject(new Error('Stripe subscriptions are unavailable'));
  }

  resolveSubscriptionForCharge(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
}

export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe' as const;
  private readonly client: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
    client?: Stripe,
  ) {
    this.client = client ?? new Stripe(secretKey);
  }

  async createCustomer(
    input: {
      organizationId: string;
      organizationName: string;
      ownerEmail: string;
    },
    idempotencyKey: string,
  ): Promise<ProviderCustomer> {
    const customer = await this.client.customers.create(
      {
        email: input.ownerEmail,
        name: input.organizationName,
        description: `ShipFlow organization ${input.organizationId}`,
        metadata: { organizationId: input.organizationId },
      },
      { idempotencyKey },
    );
    return { customerId: customer.id };
  }

  async createCheckoutSession(
    input: {
      customerId: string;
      organizationId: string;
      interval: BillingInterval;
      priceId: string;
      trialDays?: number;
      successUrl: string;
      cancelUrl: string;
      automaticTaxEnabled: boolean;
    },
    idempotencyKey: string,
  ): Promise<ProviderCheckoutSession> {
    const session = await this.client.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: input.customerId,
        client_reference_id: input.organizationId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        payment_method_collection: 'always',
        billing_address_collection: 'required',
        customer_update: { address: 'auto', name: 'auto' },
        tax_id_collection: { enabled: true },
        automatic_tax: { enabled: input.automaticTaxEnabled },
        line_items: [{ price: input.priceId, quantity: 1 }],
        metadata: {
          organizationId: input.organizationId,
          interval: input.interval,
        },
        subscription_data: {
          metadata: {
            organizationId: input.organizationId,
            planCode: 'pro',
            interval: input.interval,
          },
          ...(input.trialDays ? { trial_period_days: input.trialDays } : {}),
        },
      },
      { idempotencyKey },
    );

    if (!session.url) {
      throw new Error('Stripe did not return a Checkout URL');
    }

    return {
      sessionId: session.id,
      url: session.url,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : null,
    };
  }

  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<ProviderPortalSession> {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  verifyWebhook(rawBody: Buffer, signature: string): BillingWebhookEvent {
    const event = this.client.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
    return this.mapWebhookEvent(event);
  }

  async retrieveSubscription(
    subscriptionId: string,
  ): Promise<ProviderSubscription> {
    return this.mapSubscription(
      await this.client.subscriptions.retrieve(subscriptionId),
    );
  }

  async cancelSubscriptionNow(
    subscriptionId: string,
  ): Promise<ProviderSubscription> {
    const current = await this.client.subscriptions.retrieve(subscriptionId);
    if (current.status === 'canceled') {
      return this.mapSubscription(current);
    }

    return this.mapSubscription(
      await this.client.subscriptions.cancel(subscriptionId, {
        invoice_now: false,
        prorate: false,
      }),
    );
  }

  async resolveSubscriptionForCharge(
    chargeId: string,
  ): Promise<string | undefined> {
    const charge = await this.client.charges.retrieve(chargeId);
    const paymentIntentId = this.resourceId(charge.payment_intent);
    if (!paymentIntentId) {
      return undefined;
    }

    const payments = await this.client.invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: paymentIntentId },
      limit: 1,
    });
    const invoiceId = this.resourceId(payments.data[0]?.invoice);
    if (!invoiceId) {
      return undefined;
    }

    const invoice = await this.client.invoices.retrieve(invoiceId);
    return this.invoiceSubscriptionId(invoice);
  }

  private mapWebhookEvent(event: Stripe.Event): BillingWebhookEvent {
    const base = {
      id: event.id,
      type: event.type,
      createdAt: new Date(event.created * 1000),
      providerObjectId: this.eventObjectId(event.data.object),
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = this.resourceId(session.customer);
        if (!customerId) {
          return { ...base, kind: 'unsupported' };
        }
        return {
          ...base,
          kind: 'checkout_completed',
          sessionId: session.id,
          customerId,
          organizationId:
            session.client_reference_id ??
            session.metadata?.organizationId ??
            undefined,
          subscriptionId: this.resourceId(session.subscription),
        };
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return {
          ...base,
          kind: 'subscription_changed',
          subscription: this.mapSubscription(event.data.object),
        };
      case 'invoice.paid':
      case 'invoice.payment_failed':
        return {
          ...base,
          kind: 'invoice_changed',
          invoiceId: event.data.object.id,
          subscriptionId: this.invoiceSubscriptionId(event.data.object),
        };
      case 'charge.refunded':
        return {
          ...base,
          kind: 'charge_refunded',
          chargeId: event.data.object.id,
          fullyRefunded:
            event.data.object.refunded ||
            event.data.object.amount_refunded >= event.data.object.amount,
        };
      case 'charge.dispute.created':
        return {
          ...base,
          kind: 'charge_disputed',
          chargeId: this.resourceId(event.data.object.charge) ?? '',
        };
      default:
        return { ...base, kind: 'unsupported' };
    }
  }

  private mapSubscription(
    subscription: Stripe.Subscription,
  ): ProviderSubscription {
    const item = subscription.items.data[0];
    if (!item?.price.recurring) {
      throw new Error('Stripe subscription has no recurring price item');
    }
    const customerId = this.resourceId(subscription.customer);
    if (!customerId) {
      throw new Error('Stripe subscription has no customer');
    }

    return {
      id: subscription.id,
      customerId,
      organizationId: subscription.metadata.organizationId || undefined,
      productId: this.resourceId(item.price.product) ?? '',
      priceId: item.price.id,
      interval:
        item.price.recurring.interval === 'year'
          ? BillingInterval.ANNUAL
          : BillingInterval.MONTHLY,
      status: this.subscriptionStatus(subscription.status),
      automaticTaxEnabled: subscription.automatic_tax.enabled,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      trialStart: this.timestamp(subscription.trial_start),
      trialEnd: this.timestamp(subscription.trial_end),
      canceledAt: this.timestamp(subscription.canceled_at),
      endedAt: this.timestamp(subscription.ended_at),
      latestInvoiceId: this.resourceId(subscription.latest_invoice) ?? null,
    };
  }

  private subscriptionStatus(
    status: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    const statuses: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      canceled: SubscriptionStatus.CANCELED,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      past_due: SubscriptionStatus.PAST_DUE,
      paused: SubscriptionStatus.PAUSED,
      trialing: SubscriptionStatus.TRIALING,
      unpaid: SubscriptionStatus.UNPAID,
    };
    return statuses[status];
  }

  private invoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
    return this.resourceId(invoice.parent?.subscription_details?.subscription);
  }

  private resourceId(resource: { id: string } | string | null | undefined) {
    return typeof resource === 'string' ? resource : resource?.id;
  }

  private eventObjectId(object: object): string | undefined {
    if ('id' in object && typeof object.id === 'string') {
      return object.id;
    }
    return undefined;
  }

  private timestamp(value: number | null): Date | null {
    return value === null ? null : new Date(value * 1000);
  }
}

export function createBillingProvider(
  configService: ConfigService<EnvironmentVariables, true>,
): BillingProvider {
  const provider =
    configService.getOrThrow<EnvironmentVariables['BILLING_PROVIDER']>(
      'BILLING_PROVIDER',
    );
  if (provider === 'stripe') {
    return new StripeBillingProvider(
      configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
      configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
    );
  }
  return new StubBillingProvider();
}
