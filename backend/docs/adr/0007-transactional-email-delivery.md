# ADR 0007: Transactional Email Delivery

- Status: Accepted
- Date: 2026-08-08

## Context

Authentication and organization invitations initially used separate
development-only delivery adapters. Production delivery needs one replaceable
application boundary, provider-independent business services, source-controlled
templates, bounded retry behavior, and observable outcomes without persisting
raw tokens or message bodies.

## Decision

- Use one `TransactionalEmailDelivery` application interface for verification,
  password reset, organization invitation, and security notice messages.
- Use Resend as the reference production provider behind an `EmailProvider`
  adapter. Use a log adapter locally and an in-memory capture adapter in tests.
- Keep templates in source control as React email markup and render both HTML
  and plain-text content. Provider-hosted template IDs are not part of the
  application contract.
- Build all action links from `FRONTEND_URL`. Production requires HTTPS.
- Require `EMAIL_PROVIDER=resend`, a verified sender, API key, and webhook secret
  in production. Use separate sending-only, domain-scoped API keys for staging
  and production.
- Make three total synchronous delivery attempts. Retry network, rate-limit,
  concurrent-idempotency, and provider 5xx failures with jittered delays. Honor
  `Retry-After` up to five seconds. Do not retry authentication, validation,
  domain, or quota failures.
- Derive the provider idempotency key from the message category, normalized
  recipient, and sensitive operation token. Persist only the resulting hash,
  provider message ID, category, recipient, status, attempt count, timestamps,
  and safe error metadata.
- Never roll back account, token, or invitation state because delivery failed.
  Return the existing enumeration-safe API response, record the failure, and
  let the existing resend operation issue a fresh token.
- Accept Resend events at `/api/v1/webhooks/resend`. Verify the raw request body
  and signature, deduplicate by `svix-id`, and ignore status updates older than
  the latest recorded provider event.
- Track sent, delivered, failed, bounced, complained, and suppressed outcomes.
  Do not store complete webhook payloads, rendered content, or raw tokens.
- Keep automated tests provider-free. Validate real delivery only through the
  explicit `pnpm email:smoke` deployment procedure.
- Do not add Redis or a delivery queue in this phase. Revisit asynchronous
  delivery when measured throughput or reliability requirements justify it.

## Consequences

- Authentication and organization services no longer depend on provider SDK
  types or feature-specific delivery adapters.
- Provider acceptance and later delivery outcomes are observable in PostgreSQL
  without retaining message secrets.
- A provider outage can delay email but cannot invalidate an otherwise
  successful registration, password-reset request, or invitation operation.
- Webhook delivery is at least once and may be out of order; deduplication and
  timestamp checks make processing repeatable.
- Deployment configuration must include a verified sending subdomain with SPF
  and DKIM, followed by a staged DMARC policy.
