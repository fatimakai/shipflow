import Stripe from 'stripe';
import { BillingInterval } from '../generated/prisma/enums';
import {
  StripeBillingProvider,
  StubBillingProvider,
} from './billing.providers';

interface StripeClientMock {
  checkout: { sessions: { create: jest.Mock } };
}

describe('billing providers', () => {
  it('provides deterministic local customer IDs and safe local redirects', async () => {
    const provider = new StubBillingProvider();

    await expect(
      provider.createCustomer(
        {
          organizationId: '01900000-0000-7000-8000-000000000001',
          organizationName: 'Acme',
          ownerEmail: 'owner@example.com',
        },
        'customer-key',
      ),
    ).resolves.toEqual({
      customerId: 'cus_stub_01900000000070008000000000000001',
    });
    await expect(
      provider.createPortalSession('cus_stub', 'http://localhost/billing'),
    ).resolves.toEqual({ url: 'http://localhost/billing' });
  });

  it('maps the approved Checkout policy and idempotency key to Stripe', async () => {
    const provider = new StripeBillingProvider(
      'sk_test_placeholder',
      'whsec_placeholder',
    );
    const client = (provider as unknown as { client: StripeClientMock }).client;
    client.checkout.sessions.create = jest.fn().mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/session',
      expires_at: 1_786_000_000,
    });

    await provider.createCheckoutSession(
      {
        customerId: 'cus_123',
        organizationId: 'org-123',
        interval: BillingInterval.ANNUAL,
        priceId: 'price_annual',
        trialDays: 14,
        successUrl: 'https://app.example.com/billing?success=true',
        cancelUrl: 'https://app.example.com/billing?canceled=true',
        automaticTaxEnabled: true,
      },
      'checkout-key',
    );

    expect(client.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: { enabled: true },
        billing_address_collection: 'required',
        customer: 'cus_123',
        line_items: [{ price: 'price_annual', quantity: 1 }],
        mode: 'subscription',
        payment_method_collection: 'always',
        tax_id_collection: { enabled: true },
      }),
      { idempotencyKey: 'checkout-key' },
    );
    const [params] = client.checkout.sessions.create.mock.calls[0] as [
      Stripe.Checkout.SessionCreateParams,
    ];
    expect(params.subscription_data?.trial_period_days).toBe(14);
  });

  it('verifies Stripe signatures and maps full refunds', () => {
    const secret = 'whsec_test_secret';
    const stripe = new Stripe('sk_test_placeholder');
    const provider = new StripeBillingProvider(
      'sk_test_placeholder',
      secret,
      stripe,
    );
    const payload = JSON.stringify({
      id: 'evt_refund',
      object: 'event',
      created: 1_786_000_000,
      data: {
        object: {
          id: 'ch_123',
          object: 'charge',
          amount: 2900,
          amount_refunded: 2900,
          refunded: true,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type: 'charge.refunded',
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });

    expect(provider.verifyWebhook(Buffer.from(payload), signature)).toEqual(
      expect.objectContaining({
        id: 'evt_refund',
        kind: 'charge_refunded',
        chargeId: 'ch_123',
        fullyRefunded: true,
      }),
    );
    expect(() =>
      provider.verifyWebhook(Buffer.from(payload), 'invalid'),
    ).toThrow();
  });
});
