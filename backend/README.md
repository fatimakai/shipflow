# ShipFlow Backend

ShipFlow is a commercial SaaS boilerplate built with a decoupled NestJS API and
React frontend. This repository contains the backend REST API.

## Project Roadmaps

- [Unified project roadmap](docs/roadmaps/project-roadmap.md)

The unified roadmap preserves the original phase numbers while showing backend
and frontend ownership, dependencies, implementation steps, and completion
criteria together.

## Requirements

- Node.js 24.x
- pnpm 11.x through Corepack

The supported versions are recorded in `.nvmrc` and `package.json`.

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d --wait postgres
pnpm start:dev
```

The API starts at `http://localhost:3000` with the default environment values.

## Local Database

Start the PostgreSQL 18.4 development service after Docker Desktop is running:

```bash
docker compose up -d --wait postgres
```

The database listens on `127.0.0.1:5432` and stores its data in a named Docker
volume. Redis is intentionally deferred until it has a defined responsibility.
See [Local PostgreSQL](docs/local-database.md) for health, persistence, reset,
backup, and restore workflows.

## Environment

| Variable                            | Default                   | Description                                                         |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `NODE_ENV`                          | `development`             | Runtime environment: `development`, `test`, or `production`         |
| `PORT`                              | `3000`                    | HTTP port used by the API                                           |
| `APP_NAME`                          | `ShipFlow API`            | Service name used in API documentation and health responses         |
| `LOG_LEVEL`                         | `debug` locally           | Minimum structured log level; production defaults to `info`         |
| `CORS_ORIGINS`                      | `http://localhost:5173`   | Comma-separated allowlist of browser origins                        |
| `SWAGGER_ENABLED`                   | `true` outside production | Enables Swagger UI and the OpenAPI document                         |
| `HTTP_BODY_LIMIT_BYTES`             | `1048576`                 | Maximum parsed JSON or form body size                               |
| `HTTP_REQUEST_TIMEOUT_MS`           | `30000`                   | Request receive and handler-processing timeout                      |
| `HTTP_HEADERS_TIMEOUT_MS`           | `15000`                   | Maximum time allowed to receive HTTP headers                        |
| `HTTP_KEEP_ALIVE_TIMEOUT_MS`        | `5000`                    | Idle keep-alive socket timeout                                      |
| `HTTP_TRUST_PROXY_HOPS`             | `0`                       | Exact number of reviewed reverse-proxy hops                         |
| `HTTP_MAX_REQUESTS_PER_SOCKET`      | `1000`                    | Requests accepted before retiring a keep-alive socket               |
| `RATE_LIMIT_TTL_MS`                 | `60000`                   | Default in-memory rate-limit window                                 |
| `RATE_LIMIT_MAX`                    | `120`                     | Default requests allowed per window and client                      |
| `POSTGRES_DB`                       | `shipflow`                | Local Compose database name                                         |
| `POSTGRES_USER`                     | `shipflow`                | Local Compose database user                                         |
| `POSTGRES_PASSWORD`                 | `shipflow_local_password` | Local-only Compose database password                                |
| `POSTGRES_PORT`                     | `5432`                    | Loopback port exposed by Compose                                    |
| `DATABASE_URL`                      | Local ShipFlow URL        | PostgreSQL connection URL used by Prisma                            |
| `DATABASE_POOL_MAX`                 | `10`                      | Maximum connections in the application pool                         |
| `DATABASE_CONNECTION_TIMEOUT_MS`    | `5000`                    | PostgreSQL connection timeout in milliseconds                       |
| `DATABASE_STATEMENT_TIMEOUT_MS`     | `15000`                   | PostgreSQL statement execution limit                                |
| `DATABASE_SLOW_QUERY_MS`            | `500`                     | Duration threshold for parameter-free slow-query warnings           |
| `JWT_ACCESS_SECRET`                 | Local-only value          | HS256 secret; explicit 32+ character value required in production   |
| `JWT_ACCESS_TTL_SECONDS`            | `900`                     | Access-token lifetime                                               |
| `REFRESH_TOKEN_TTL_DAYS`            | `30`                      | Rotating refresh-session lifetime                                   |
| `TWO_FACTOR_ISSUER`                 | `ShipFlow`                | Issuer shown by authenticator applications                          |
| `TWO_FACTOR_ENCRYPTION_KEY`         | Development-only key      | Canonical base64 AES-256 key; explicit value required in production |
| `TWO_FACTOR_ENCRYPTION_KEY_VERSION` | `1`                       | Positive version stored with encrypted TOTP credentials             |
| `AUTH_REFRESH_COOKIE_NAME`          | `shipflow_refresh`        | HttpOnly refresh cookie name                                        |
| `AUTH_COOKIE_SECURE`                | `false` locally           | Requires HTTPS cookies and must be `true` in production             |
| `FRONTEND_URL`                      | `http://localhost:5173`   | Frontend base URL for account links and OAuth redirects             |
| `EMAIL_PROVIDER`                    | `log` (`capture` in test) | Email adapter; production requires `resend`                         |
| `EMAIL_FROM_NAME`                   | `ShipFlow`                | Friendly sender name                                                |
| `EMAIL_FROM_ADDRESS`                | Example no-reply address  | Verified sender address                                             |
| `EMAIL_REPLY_TO`                    | Example support address   | Reply-to address                                                    |
| `EMAIL_SUPPORT_ADDRESS`             | Example support address   | Support address rendered in templates                               |
| `EMAIL_SMOKE_TEST_RECIPIENT`        | None                      | Explicit recipient for the controlled provider smoke test           |
| `RESEND_API_KEY`                    | None                      | Required when the Resend adapter is selected                        |
| `RESEND_WEBHOOK_SECRET`             | None                      | Required when the Resend adapter is selected                        |
| `BILLING_PROVIDER`                  | `stub`                    | Billing adapter; production requires `stripe`                       |
| `BILLING_TRIAL_DAYS`                | `14`                      | One-time organization trial length                                  |
| `BILLING_GRACE_PERIOD_DAYS`         | `7`                       | Paid access retained after entering `past_due`                      |
| `BILLING_CURRENCY`                  | `usd`                     | Application plan-catalog currency                                   |
| `STRIPE_SECRET_KEY`                 | None                      | Required when the Stripe adapter is selected                        |
| `STRIPE_WEBHOOK_SECRET`             | None                      | Signing secret for `POST /api/v1/webhooks/stripe`                   |
| `STRIPE_PRO_PRODUCT_ID`             | Local placeholder         | Approved Pro product ID                                             |
| `STRIPE_PRO_MONTHLY_PRICE_ID`       | Local placeholder         | Approved USD 29 monthly price ID                                    |
| `STRIPE_PRO_ANNUAL_PRICE_ID`        | Local placeholder         | Approved USD 290 annual price ID                                    |
| `STRIPE_AUTOMATIC_TAX_ENABLED`      | `false` locally           | Must be `true` in production                                        |
| `FILE_STORAGE_PROVIDER`             | `local`                   | File adapter; production requires `s3`                              |
| `FILE_LOCAL_ROOT`                   | `.data/files`             | Private non-public local object root                                |
| `FILE_MALWARE_SCAN_ENABLED`         | `false` locally           | Must be `true` for production S3 storage                            |
| `AWS_REGION`                        | None                      | Required AWS Region for the S3 adapter                              |
| `S3_BUCKET`                         | None                      | Required private production bucket                                  |
| `S3_ENDPOINT`                       | None                      | Optional S3-compatible endpoint for controlled environments         |
| `S3_FORCE_PATH_STYLE`               | `false`                   | Enables path-style addressing for compatible test services          |

Application runtime values, including the Prisma connection settings, are
loaded through `@nestjs/config` and validated with Joi. Invalid application
values stop startup. Docker Compose consumes the `POSTGRES_*` values.

## Prisma

Prisma ORM uses the `pg` driver adapter and a generated CommonJS client under
`src/generated/prisma`. The generated client is committed so a clean checkout
can compile and test without generating files during installation.
The integration decisions are recorded in
[ADR 0002](docs/adr/0002-prisma-database-integration.md).

Run these commands after changing `prisma/schema.prisma`:

```bash
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
```

Create and apply migrations only when implementing an approved schema change:

```bash
pnpm prisma:migrate:dev
pnpm prisma:migrate:deploy
pnpm prisma:seed
```

The initial identity and tenancy schema covers users, OAuth accounts, rotating
refresh sessions, verification and password-reset tokens, organizations,
memberships, and invitations. Its conventions and lifecycle rules are recorded
in [ADR 0003](docs/adr/0003-initial-identity-tenancy-schema.md). Billing extends
that baseline with organization-owned customers and subscriptions.

`pnpm prisma:seed` is development-only and idempotently creates
`owner@shipflow.local`, `member@shipflow.local`, and the `shipflow-demo`
organization. It does not create passwords or authentication secrets.

## API Foundation

| Endpoint                   | Purpose                            |
| -------------------------- | ---------------------------------- |
| `GET /api/v1`              | API welcome response               |
| `GET /api/v1/health`       | Application readiness summary      |
| `GET /api/v1/health/live`  | Process liveness check             |
| `GET /api/v1/health/ready` | Traffic readiness check            |
| `GET /api/docs`            | Swagger UI when enabled            |
| `GET /api/docs-json`       | OpenAPI JSON document when enabled |

## Authentication

Local authentication supports registration, login, current-user lookup,
atomic refresh-token rotation, reuse detection, current/all-session logout,
email verification, password reset, and authenticator-app two-factor
authentication. When 2FA is enabled, password and OAuth first factors return a
five-minute opaque challenge instead of creating a session. Access and refresh
tokens are issued only after a valid TOTP or single-use recovery code. The
security and lifecycle decisions are recorded in
[ADR 0004](docs/adr/0004-backend-authentication.md),
[ADR 0012](docs/adr/0012-two-factor-security-foundation.md), and
[ADR 0013](docs/adr/0013-two-factor-lifecycle.md).

| Endpoint                                        | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `POST /api/v1/auth/register`                    | Create an account and session        |
| `POST /api/v1/auth/login`                       | Authenticate local credentials       |
| `POST /api/v1/auth/refresh`                     | Rotate a refresh token               |
| `POST /api/v1/auth/logout`                      | Revoke the current refresh session   |
| `POST /api/v1/auth/logout-all`                  | Revoke all refresh sessions          |
| `GET /api/v1/auth/me`                           | Return the authenticated user        |
| `POST /api/v1/auth/email-verification/request`  | Issue a verification token           |
| `POST /api/v1/auth/email-verification/confirm`  | Consume a verification token         |
| `POST /api/v1/auth/password/forgot`             | Issue a password-reset token         |
| `POST /api/v1/auth/password/reset`              | Consume a password-reset token       |
| `GET /api/v1/auth/oauth/google`                 | Start configured Google OAuth        |
| `GET /api/v1/auth/oauth/github`                 | Start configured GitHub OAuth        |
| `GET /api/v1/auth/2fa/status`                   | Return current 2FA status            |
| `POST /api/v1/auth/2fa/setup`                   | Begin authenticator setup            |
| `POST /api/v1/auth/2fa/setup/confirm`           | Enable 2FA and show recovery codes   |
| `POST /api/v1/auth/2fa/challenge/verify`        | Complete a login challenge           |
| `POST /api/v1/auth/2fa/backup-codes/regenerate` | Replace recovery codes after step-up |
| `DELETE /api/v1/auth/2fa`                       | Disable 2FA after step-up            |

Verification and reset messages use the shared transactional email interface.
The local log adapter records safe acceptance metadata without writing raw
tokens. Google and GitHub endpoints return `503` until their client ID and
secret pairs are configured.

## Organizations and Multi-Tenancy

Authenticated users can belong to multiple organizations through explicit
organization-scoped routes. Organization creation and invitation acceptance
require a verified email address. Tenant context is resolved from both the
organization ID and authenticated user ID, and inaccessible organizations return
`404` even when a valid resource ID from another tenant is supplied.

| Endpoint                                                                      | Purpose                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| `POST /api/v1/organizations`                                                  | Create an organization and Owner membership |
| `GET /api/v1/organizations`                                                   | List the current user's organizations       |
| `GET /api/v1/organizations/:organizationId`                                   | Get an accessible organization              |
| `PATCH /api/v1/organizations/:organizationId`                                 | Update an organization name                 |
| `DELETE /api/v1/organizations/:organizationId`                                | Soft-delete an owned organization           |
| `POST /api/v1/organizations/:organizationId/invitations`                      | Create an organization invitation           |
| `GET /api/v1/organizations/:organizationId/invitations`                       | List organization invitations               |
| `POST /api/v1/organizations/:organizationId/invitations/:invitationId/resend` | Rotate and resend an invitation             |
| `DELETE /api/v1/organizations/:organizationId/invitations/:invitationId`      | Revoke a pending invitation                 |
| `POST /api/v1/invitations/accept`                                             | Accept an email-bound invitation            |
| `GET /api/v1/organizations/:organizationId/members`                           | List organization members                   |
| `PATCH /api/v1/organizations/:organizationId/members/:membershipId`           | Change a non-owner membership role          |
| `DELETE /api/v1/organizations/:organizationId/members/:membershipId`          | Remove an organization member               |
| `POST /api/v1/organizations/:organizationId/leave`                            | Leave an organization                       |
| `POST /api/v1/organizations/:organizationId/ownership-transfer`               | Transfer ownership transactionally          |

Invitations expire after seven days, are stored only as token hashes, and are
bound to the invited normalized email. Invitation messages use the same shared
transactional email interface as authentication. The lifecycle, interim
management hierarchy, slug policy, and tenant-isolation rules are recorded in
[ADR 0005](docs/adr/0005-organizations-and-multi-tenancy.md).

## Transactional Email

Resend is the production reference provider. Development uses a safe log
adapter and tests use an in-memory capture adapter. Verification, password
reset, invitation, and security-notice templates are source-controlled and
render both HTML and plain text. The application records delivery metadata but
never stores raw action tokens, rendered messages, or complete webhook payloads.

| Backend output                   | Frontend destination            |
| -------------------------------- | ------------------------------- |
| Email verification link          | `/verify-email?token=...`       |
| Password reset link              | `/reset-password?token=...`     |
| Organization invitation link     | `/invitations/accept?token=...` |
| Resend provider webhook endpoint | `POST /api/v1/webhooks/resend`  |

For staging and production, verify a dedicated sending subdomain such as
`mail.example.com`, configure SPF and DKIM, introduce DMARC in stages, and use a
separate sending-only API key per environment. Configure Resend to send
`email.sent`, `email.delivered`, `email.bounced`, `email.complained`,
`email.failed`, and `email.suppressed` events to the webhook endpoint.

After migrations and deployment, set `EMAIL_SMOKE_TEST_RECIPIENT` to a controlled
mailbox and run `pnpm email:smoke`. The command refuses non-Resend adapters and
returns a failure exit code unless the provider accepts the message. It is a
manual deployment check and is never part of automated tests. The delivery,
retry, idempotency, and failure decisions are recorded in
[ADR 0007](docs/adr/0007-transactional-email-delivery.md).

## Stripe Billing

Billing is organization-level and Owner-only. The local plan catalog offers
Free and Pro; Pro is USD 29 monthly or USD 290 annually. Checkout provides one
card-required 14-day trial per organization, and the Customer Portal owns
period-end cancellation, reactivation, payment methods, invoices, and billing
details.

| Endpoint                                                              | Purpose                                  |
| --------------------------------------------------------------------- | ---------------------------------------- |
| `GET /api/v1/billing/plans`                                           | List the active local plan catalog       |
| `GET /api/v1/organizations/:organizationId/billing`                   | Read local billing and entitlement state |
| `POST /api/v1/organizations/:organizationId/billing/checkout-session` | Create a hosted Checkout session         |
| `POST /api/v1/organizations/:organizationId/billing/portal-session`   | Create a hosted Customer Portal session  |
| `POST /api/v1/webhooks/stripe`                                        | Receive signed Stripe lifecycle events   |

For production, create one Pro product with recurring USD 29 monthly and USD
290 annual prices. Set their IDs in the Stripe environment variables, enable
the Customer Portal, Stripe Tax, Smart Retries, and Stripe failed-payment
emails, then subscribe the webhook endpoint to `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
`charge.refunded`, and `charge.dispute.created`.

Stripe remains authoritative for payment lifecycle changes. PostgreSQL is
authoritative for request-time entitlements: `trialing` and `active` receive Pro,
and `past_due` retains Pro for seven days. All other states receive Free. Full
refunds and disputes immediately cancel the subscription and remove paid
access; partial refunds do not. The commercial and synchronization rules are
recorded in [ADR 0008](docs/adr/0008-stripe-billing.md).

## File Storage

File storage is organization-scoped and capability-protected. Development and
tests use private local storage under `.data/files`; production requires a
private S3 bucket with GuardDuty malware scanning. A provider switch requires
environment changes, not application code changes.

| Endpoint                                                               | Purpose                                      |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| `POST /api/v1/organizations/:organizationId/files/uploads`             | Reserve quota and create a signed upload     |
| `POST /api/v1/organizations/:organizationId/files/:fileId/complete`    | Validate the upload and begin malware review |
| `GET /api/v1/organizations/:organizationId/files`                      | List active or lifecycle-filtered files      |
| `GET /api/v1/organizations/:organizationId/files/usage`                | Read plan storage usage and limits           |
| `GET /api/v1/organizations/:organizationId/files/:fileId`              | Read file metadata                           |
| `GET /api/v1/organizations/:organizationId/files/:fileId/download-url` | Create a five-minute private download URL    |
| `DELETE /api/v1/organizations/:organizationId/files/:fileId`           | Start the 30-day recovery period             |
| `POST /api/v1/organizations/:organizationId/files/:fileId/restore`     | Restore a recoverable file                   |

Upload clients calculate the exact byte length and SHA-256 checksum, request a
reservation, submit a multipart form using every returned `fields` entry and
the returned `fileField`, then call the completion endpoint. Local signed URLs
pass through the API; S3 signed URLs transfer directly to the bucket.

Files are limited to 25 MiB. The accepted allowlist is PDF, JPEG, PNG, WebP,
UTF-8 TXT/CSV/JSON, DOCX, XLSX, and PPTX. Free organizations receive 100 MiB and
100 files; Pro organizations receive 10 GiB and 10,000 files. Active,
scanning, ready, and recoverable deleted objects count toward quota.

Before production deployment, configure the bucket, IAM role, frontend CORS,
GuardDuty result tagging and tag-based read policy, and S3 lifecycle safeguards.
See [ADR 0010](docs/adr/0010-file-storage.md) for the exact provider, security,
retention, malware, and cleanup decisions.

## Notifications

Notifications are persistent, user-owned, and in-app only. Security and billing
notifications are mandatory; organization activity is enabled by default and
may be disabled globally by each user. Records may reference an organization
for filtering, but current organization membership never grants access to
another user's notifications.

| Endpoint                                           | Purpose                                  |
| -------------------------------------------------- | ---------------------------------------- |
| `GET /api/v1/notifications`                        | List notifications with an opaque cursor |
| `GET /api/v1/notifications/unread-count`           | Count unread notifications               |
| `PATCH /api/v1/notifications/:notificationId/read` | Mark one notification as read            |
| `POST /api/v1/notifications/mark-all-read`         | Mark current matching records as read    |
| `GET /api/v1/notifications/preferences`            | Read notification preferences            |
| `PATCH /api/v1/notifications/preferences`          | Update the Organization category setting |

List and count endpoints accept an optional `organizationId`; list also accepts
`unreadOnly`, `limit`, and the opaque `cursor` returned by the previous page.
The default page size is 20 and the maximum is 100. Mark-all-read uses the
request start as a cutoff and therefore does not affect records created while
the update is running.

Notifications expire after 90 days and are hard-deleted by an idempotent
startup and six-hour retention pass. Domain services create records in the same
database transaction as password, organization, or billing changes and use
user-scoped deduplication keys. The frontend should poll unread count every 30
seconds while visible, refresh on focus, and pause while hidden. The persistence,
preference, recipient, and polling rules are recorded in
[ADR 0009](docs/adr/0009-notification-backend.md).

## Authorization

Organization authorization uses named capabilities from a central role matrix.
Every organization-scoped controller method declares its required capability;
the guard resolves membership and tenant context before the service receives the
request. Inaccessible tenants return `404`, while members lacking a required
capability receive `403`.

Organization responses include `currentUserCapabilities` for frontend
navigation and control states. These values never replace backend enforcement.
The approved baseline is:

| Role   | Baseline access                                                                           |
| ------ | ----------------------------------------------------------------------------------------- |
| Owner  | All capabilities; ownership must be transferred before leaving                            |
| Admin  | Organization updates, ordinary membership/invitation management, notifications, and files |
| Member | Organization/member reads, own notifications, and file read/upload/delete                 |
| Viewer | Organization/member reads, own notifications, and file read/download only                 |

Billing is Owner-only. Admins cannot manage other Admins, and only Owners can
transfer ownership or delete an organization. The complete capability matrix,
dynamic hierarchy rules, and extension requirements are recorded in
[ADR 0006](docs/adr/0006-role-based-access-control.md).

API endpoints use URI versioning under `/api/v1`. Global request validation
rejects properties that are not declared by a DTO. Error responses include a
consistent status, message, timestamp, request path, and request ID. The API
accepts a valid `x-request-id` header or generates one for each request.

Readiness checks both application configuration and PostgreSQL connectivity.
The application establishes one connection pool during startup and closes it
during graceful shutdown.

The accepted local infrastructure decisions are recorded in
[ADR 0001](docs/adr/0001-local-database-infrastructure.md).

## Application Audit Log

Security-sensitive authentication, 2FA, organization, membership, billing, and
file operations produce structured PostgreSQL audit records. Records contain
bounded request context and stable entity identifiers, never request/response
bodies, passwords, tokens, TOTP secrets, recovery codes, cookies, or provider
signatures. Authentication and authorization failures are included even when a
request is rejected by a guard before reaching its controller.

Audit rows are backend-only, append-only, and retained for 365 days. A database
trigger normalizes the expiry deadline and rejects updates and premature
deletes; an idempotent startup and daily maintenance pass removes only expired
records. The schema, failure behavior, privacy boundary, and event coverage are recorded in
[ADR 0014](docs/adr/0014-application-audit-log.md).

## Production Baseline

The provider-independent Phase 14 baseline emits redacted newline-delimited JSON
logs, applies Helmet security headers, disables API caching and framework
identification, bounds request bodies and processing time, and trusts no proxy by
default. PostgreSQL statements have an execution timeout, and slow-query events
contain timing and target information without SQL parameters.

The [production Dockerfile](Dockerfile) uses separate dependency, build,
migration, and runtime stages. The final image contains production dependencies
and compiled output only, runs as the unprivileged `node` user, and checks the
database-backed readiness endpoint. The current topology supports exactly one
backend instance because rate limits remain in memory.

Deployment sequencing, migration rollback, database backup and confirmed
restore, incident handling, and acceptance evidence are documented in the
[production baseline runbook](docs/production-baseline.md). The decisions and
remaining provider-dependent work are recorded in
[ADR 0011](docs/adr/0011-provider-independent-production-baseline.md).

## Commands

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm lint:fix
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm prisma:seed
pnpm db:backup
pnpm db:restore -- --help
pnpm test
pnpm test:e2e
pnpm build
pnpm security:audit
pnpm email:smoke
pnpm start:dev
pnpm start:prod
```

`pnpm test:e2e` requires the local PostgreSQL service to be healthy.

## Repository Model

ShipFlow uses a polyrepo architecture. The frontend and backend are deployed
independently, and this API's Swagger/OpenAPI document is the initial contract
between them.
