# ADR 0011: Provider-Independent Production Baseline

## Status

Accepted on 2026-08-10 as the first portion of Phase 14.

## Decision

- Emit newline-delimited JSON application logs to standard output and errors to
  standard error. Redact credentials, cookies, tokens, signatures, email fields,
  database passwords, and action-token query values before serialization.
- Add Helmet security headers before all other middleware, disable framework
  identification, prevent API response caching, and enable HSTS in production.
- Limit parsed JSON and form bodies to 1 MiB, request processing to 30 seconds,
  headers to 15 seconds, keep-alive idle time to 5 seconds, and each socket to
  1,000 requests by default.
- Trust no reverse proxy by default. `HTTP_TRUST_PROXY_HOPS` must match the
  reviewed deployment path before relying on forwarded client addresses.
- Keep rate limiting in application memory for the initial single-instance
  topology. Its limits are configurable, but multiple instances are not
  approved until a shared rate-limit store is selected.
- Apply a 15-second PostgreSQL statement timeout and emit duration-only warnings
  for queries taking at least 500 milliseconds. Never log SQL parameters.
- Continue using the liveness and PostgreSQL-backed readiness endpoints and
  graceful Nest shutdown hooks.
- Build a multi-stage Debian-based Node 24 image. The final image contains only
  production dependencies and compiled output and runs as the unprivileged
  `node` user. A separate `migrate` target owns deployment migrations.
- Provide explicit backup and confirmed restore commands around PostgreSQL's
  native custom-format tooling. Do not include database passwords in command
  arguments or output.
- Keep production logs on standard streams and operational procedures portable
  until hosting, monitoring, and logging providers are approved.

## Security Review

- Refresh and OAuth cookies are HttpOnly, `SameSite=Lax`, and required to be
  Secure in production.
- Browser endpoints that create, rotate, consume, or clear refresh cookies
  enforce the configured Origin allowlist with Referer fallback and Fetch
  Metadata checks. Rejections are audited. OAuth callbacks additionally require
  one-time state.
- Access tokens accept only HS256 and are validated against active users.
- Stripe and Resend callbacks require provider signatures over raw request bytes.
- Organization controllers enforce membership and named capabilities before
  tenant services receive a request.
- File downloads require authorization before a short-lived signed URL is
  issued; local signed content routes validate HMAC and expiry.

## Explicit Deferrals

- Centralized error monitoring, alert delivery, log retention, and uptime checks
  require provider selection.
- Automated encrypted off-site backup retention requires the production database
  and storage topology.
- Shared rate limits require Redis or another approved shared store before the
  backend may run with more than one application instance.

## Consequences

The backend now has a deployable and testable single-instance security baseline
without binding buyers to a hosting or observability vendor. Phase 14 remains in
progress because deployment-specific monitoring, backup automation, restoration
evidence, and production acceptance evidence still require an environment.
