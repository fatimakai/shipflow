import { Inject } from '@nestjs/common';
import { BillingInterval, SubscriptionStatus } from '../generated/prisma/enums';

export const BILLING_PROVIDER_CLIENT = Symbol('BILLING_PROVIDER_CLIENT');

export const InjectBillingProvider = () => Inject(BILLING_PROVIDER_CLIENT);

export interface ProviderCustomer {
  customerId: string;
}

export interface ProviderCheckoutSession {
  sessionId: string;
  url: string;
  expiresAt: Date | null;
}

export interface ProviderPortalSession {
  url: string;
}

export interface ProviderSubscription {
  id: string;
  customerId: string;
  organizationId?: string;
  productId: string;
  priceId: string;
  interval: BillingInterval;
  status: SubscriptionStatus;
  automaticTaxEnabled: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  latestInvoiceId: string | null;
}

interface BillingWebhookEventBase {
  id: string;
  type: string;
  createdAt: Date;
  providerObjectId?: string;
}

export type BillingWebhookEvent =
  | (BillingWebhookEventBase & {
      kind: 'checkout_completed';
      sessionId: string;
      customerId: string;
      organizationId?: string;
      subscriptionId?: string;
    })
  | (BillingWebhookEventBase & {
      kind: 'subscription_changed';
      subscription: ProviderSubscription;
    })
  | (BillingWebhookEventBase & {
      kind: 'invoice_changed';
      invoiceId: string;
      subscriptionId?: string;
    })
  | (BillingWebhookEventBase & {
      kind: 'charge_refunded';
      chargeId: string;
      fullyRefunded: boolean;
    })
  | (BillingWebhookEventBase & {
      kind: 'charge_disputed';
      chargeId: string;
    })
  | (BillingWebhookEventBase & { kind: 'unsupported' });

export interface BillingProvider {
  readonly name: 'stub' | 'stripe';
  createCustomer(
    input: {
      organizationId: string;
      organizationName: string;
      ownerEmail: string;
    },
    idempotencyKey: string,
  ): Promise<ProviderCustomer>;
  createCheckoutSession(
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
  ): Promise<ProviderCheckoutSession>;
  createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<ProviderPortalSession>;
  verifyWebhook(rawBody: Buffer, signature: string): BillingWebhookEvent;
  retrieveSubscription(subscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscriptionNow(subscriptionId: string): Promise<ProviderSubscription>;
  resolveSubscriptionForCharge(chargeId: string): Promise<string | undefined>;
}
