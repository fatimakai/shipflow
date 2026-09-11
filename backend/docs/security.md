# ShipFlow Security Architecture

This document records the implemented application-security controls for the
ShipFlow API. It describes the current code rather than aspirational controls.
Deployment-specific acceptance evidence remains in
[production-baseline.md](production-baseline.md).

## Threat Model And Trust Boundaries

- PostgreSQL is the durable trust boundary for identities, tenant memberships,
  sessions, subscriptions, file metadata, notifications, and audit records.
- Every tenant-owned request resolves an authenticated user and organization
  membership before a service receives tenant data.
- The React application is a public client. It never receives a refresh token,
  OAuth client secret, TOTP secret after setup, storage credential, provider
  secret, or database credential.
- Stripe, Resend, OAuth providers, object storage, and the malware scanner are
  external boundaries. Signed callbacks are verified over raw bytes before
  their payloads are processed.

## Authentication And Session Controls

- Passwords use Argon2id with explicit memory, time, and parallelism costs.
- Access tokens are short-lived HS256 bearer tokens held in frontend memory.
  The API validates the algorithm, signature, expiry, issuer, audience, subject,
  and current user status.
- Refresh tokens are opaque, hashed at rest, rotated on every use, grouped into
  token families, and revoked as a family when reuse is detected.
- Refresh cookies are `HttpOnly`, `SameSite=Lax`, path-scoped to the auth API,
  and required to be `Secure` in production.
- Google and GitHub callbacks require a signed, one-time OAuth state cookie.
- TOTP is enforced after either password or OAuth first-factor authentication.
  A five-minute, single-purpose challenge is exchanged for a normal session
  only after TOTP or a one-use recovery code succeeds.
- TOTP credentials are AES-256-GCM encrypted with versioned keys. Ten recovery
  codes are shown once and stored as individual Argon2id hashes.
- Changing 2FA requires password and second-factor step-up when a local password
  exists, or second-factor step-up for OAuth-only accounts. No device bypass is
  implemented.

## CSRF Decision

ShipFlow does not add a synchronizer or double-submit CSRF token in v1 because
normal application authorization uses a bearer token that browsers do not
attach automatically. The smaller set of endpoints that create, rotate,
consume, or clear the refresh cookie uses layered browser-request checks:

1. `Origin` is compared exactly against the configured CORS allowlist.
2. `Referer` supplies the source origin when `Origin` is unavailable.
3. `Sec-Fetch-Site: cross-site` and `Sec-Fetch-Site: none` are rejected.
4. Malformed and explicitly untrusted source signals are rejected and audited.
5. Responses vary on `Origin` and `Sec-Fetch-Site` to prevent cache confusion.

Requests with none of these browser-controlled headers remain available to
non-browser API clients. That compatibility path cannot create a browser CSRF
primitive by itself: attacker scripts cannot forge trusted values for these
forbidden request headers, modern cross-site requests supply Fetch Metadata or
an origin signal, and the cookie also uses `SameSite=Lax`. OAuth callbacks are
an explicit exception because they are cross-origin navigations; their one-time
signed state is the request-forgery control. Stripe and Resend webhooks use
provider signatures and do not use browser cookies.

## Input Validation Inventory

The global Nest validation pipe enables transformation, allowlisting, and
`forbidNonWhitelisted`. Unknown DTO properties are rejected rather than silently
accepted. DTO fields use type, length, range, enum, email, UUID, or fixed-format
validators as appropriate.

| Input surface                                     | Validation boundary                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Registration, login, profile, account tokens, 2FA | Auth request DTOs; strict password, token, TOTP, and recovery-code bounds                                 |
| Organizations, invitations, memberships           | Request/query DTOs; UUID pipes for nested identifiers; organization guard validates the route tenant UUID |
| Billing                                           | Billing interval enum DTO; server-owned plan and price mapping                                            |
| Notifications                                     | Bounded cursor/page query DTOs, UUID filters, boolean preference DTO                                      |
| Files                                             | Bounded filename/size DTO, MIME allowlist, SHA-256 format, UUID pipes, signed local-transfer query DTO    |
| OAuth callbacks                                   | Provider strategy plus signed, expiring, one-use state                                                    |
| Stripe and Resend webhooks                        | Provider signature over raw body, event allowlists, and idempotent event storage                          |
| Health and plan catalog                           | No caller-controlled values                                                                               |

Parsed JSON and form bodies are capped at 1 MiB by default. URL-encoded parsing
does not permit nested object syntax. HTTP header, request, database statement,
and socket-lifetime limits are independently configurable and startup-validated.

## Browser And HTTP Controls

Production API responses use a deny-by-default CSP (`default-src 'none'`) with
explicit `base-uri`, `form-action`, and `frame-ancestors` denial. Helmet also
sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS in production,
cross-origin policies, legacy cross-domain-policy denial, and related hardening
headers. ShipFlow additionally sets a restrictive `Permissions-Policy`,
`Referrer-Policy: no-referrer`, `Cache-Control: no-store`, and removes
`X-Powered-By`.

CSP is disabled only outside production so the local Swagger UI can execute.
Swagger defaults to disabled in production. CORS allows credentials only for
explicit, normalized HTTP(S) origins and a narrow method/header list.

## Authorization And Tenant Isolation

- Controllers declare named capabilities rather than comparing role strings.
- The organization authorization guard validates the organization UUID,
  resolves membership scoped to the current user, and checks all required
  capabilities before exposing organization context.
- Tenant services include organization identifiers in database predicates.
- Unauthorized access attempts return non-enumerating responses and create
  bounded audit events without request bodies or credentials.

## Audit Logging And Sensitive Data

Sensitive authentication, authorization, membership, ownership, billing, 2FA,
and file-lifecycle outcomes create structured database audit records. The writer
redacts credential-like keys, strips control characters, bounds metadata, and
never stores request bodies. PostgreSQL prevents updates and premature deletes,
normalizes expiry to one year, and permits the retention worker to delete only
expired records. See [ADR 0014](adr/0014-application-audit-log.md).

Structured runtime logs separately redact passwords, cookies, authorization
headers, action tokens, signatures, email fields, connection credentials, and
TOTP provisioning material.

## File And Provider Security

- Objects are private and accessed only through short-lived signed operations.
- Uploads are reservations with size, checksum, MIME, tenancy, and expiry
  validation. Completion revalidates stored object metadata.
- Production requires S3-compatible private storage and malware scanning. The
  current provider reads S3 GuardDuty result tags. The approved Cloudflare R2
  and self-hosted ClamAV topology still requires its dedicated scanner adapter
  in the production-integration phase.
- Provider webhook processing is signature-verified and idempotent. Stripe
  checkout uses server-owned price identifiers and no card data enters ShipFlow.

## Operational Requirements And Residual Risks

- TLS termination and the exact trusted-proxy hop count must be verified in the
  deployed Render topology before release.
- The current rate limiter is process-local, so the approved deployment remains
  one application instance until a shared store is introduced.
- Logs, alerts, uptime monitoring, encrypted off-site backups, and restoration
  evidence require the production providers and are deployment acceptance work.
- Replace the current GuardDuty result-tag reader with the approved Cloudflare
  R2 and self-hosted ClamAV scan path before the production storage provider is
  enabled.
- Account recovery never bypasses 2FA automatically. Support must verify identity
  out of band before an authorized administrator manually disables 2FA; that
  administration action is intentionally reserved for the recovery phase.
- Production dependency auditing runs against runtime dependencies. Temporary
  transitive overrides and their removal criteria are documented in
  [production-baseline.md](production-baseline.md).
