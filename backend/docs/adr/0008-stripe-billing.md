# ADR 0008: Organization Stripe Billing

- Status: Accepted
- Date: 2026-08-08

## Context

Shipflow needs organization-level subscriptions while keeping payment data and
payment lifecycle operations in Stripe. Request-time feature authorization must
remain fast, tenant-safe, and available during a transient Stripe outage.

## Decision

- Offer an application-owned Free plan and one Stripe-backed Pro product. Pro is
  USD 29 monthly or USD 290 annually. There are no seats, usage meters, or
  one-time products in v1.
- Allow one subscription per organization. Only the organization Owner can read
  or manage billing.
- Reserve one pending Checkout session per organization. Reuse an unexpired
  session for the same interval, reject a competing interval, and clear the
  reservation when Stripe reports a subscription.
- Use hosted Stripe Checkout and the Stripe Customer Portal. Collect a payment
  method, billing address, customer name, and tax IDs in Checkout.
- Offer one card-required 14-day trial per organization. Persist the first trial
  use locally so canceled organizations cannot claim another trial.
- Enable Stripe Tax in production with USD-exclusive prices. Tax registrations
  and jurisdiction configuration remain deployment responsibilities in Stripe.
- Cancel through the Portal at period end and allow Portal reactivation before
  the period ends. Immediate cancellation is reserved for a full current-period
  refund, dispute, fraud, or administrative provider action.
- Use Stripe Smart Retries and Stripe failed-payment emails. Preserve Pro access
  for seven days after a subscription enters `past_due`; do not extend that
  grace window on repeated failures.
- Treat `trialing` and `active` as paid. Treat `past_due` as paid only before the
  local grace deadline. Treat `incomplete`, `incomplete_expired`, `unpaid`,
  `canceled`, and `paused` as Free.
- Keep Stripe authoritative for payment lifecycle events and PostgreSQL
  authoritative for request-time entitlements. Do not call Stripe while serving
  entitlement checks.
- Maintain the plan and feature catalog locally. Do not use Stripe Entitlements
  in v1.
- Accept Stripe events at `/api/v1/webhooks/stripe`. Verify the raw body and
  Stripe signature, deduplicate event IDs, retrieve current subscription state,
  and ignore older local synchronization timestamps.
- Process partial refunds without changing entitlement state. A full refund or
  dispute resolves the related subscription, cancels it immediately without a
  second proration or invoice, and removes paid access.
- Use a provider-neutral billing interface, the official Stripe SDK in
  production, and a deterministic local stub for development and automated
  tests.

## Consequences

- API requests authorize paid features from PostgreSQL even if Stripe is
  temporarily unavailable.
- Stripe webhooks and the Customer Portal are required deployment dependencies.
- Duplicate, retried, failed, and out-of-order events are safe to process.
- Refunds remain manual in Stripe; backend webhook handling applies the approved
  entitlement consequence.
- Adding seats, usage pricing, more paid products, custom retry logic, or Stripe
  Entitlements requires a new product decision and schema review.
