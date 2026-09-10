# ADR 0004: Backend Authentication and Session Security

- Status: Accepted
- Date: 2026-08-07

## Context

Shipflow needs a complete backend account lifecycle that supports browser
clients, concurrent devices, local credentials, and optional OAuth providers.
Authentication must remain usable without Redis or a production email provider
while preserving clear replacement points for later phases.

## Decision

- Normalize email addresses by trimming and lowercasing before lookup or
  persistence.
- Hash local passwords with Argon2id using 19 MiB of memory, two iterations,
  and one lane. Accept passwords from 12 through 128 characters without
  composition rules.
- Issue HS256 access tokens for 15 minutes. Require an explicit secret of at
  least 32 characters in production and accept access tokens only through the
  `Authorization: Bearer` header.
- Issue 32-byte opaque refresh tokens for 30 days. Store only SHA-256 token
  hashes and bind each token to a database session and rotation family.
- Rotate refresh tokens atomically. Treat use of a rotated token as reuse and
  revoke every active session in its family.
- Store refresh tokens in `HttpOnly`, `SameSite=Lax` cookies with `Secure`
  required in production. Validate browser origins on cookie-authenticated POST
  endpoints.
- Allow concurrent refresh sessions. Logout revokes the current session;
  logout-all and password reset revoke all active refresh sessions.
- Let access tokens expire naturally after logout or password reset. Their
  maximum remaining lifetime is 15 minutes.
- Allow unverified users to authenticate, but require verification for future
  organization creation and other sensitive operations.
- Use single-use, hashed, expiring tokens for email verification and password
  reset. Return the same forgot-password response whether an account exists.
- Use Nest's in-memory throttling storage for the initial single-instance API.
  Replace it with shared storage before horizontally scaling authentication.
- Keep Google and GitHub OAuth disabled until paired credentials are supplied.
  Require verified provider email addresses, protect redirects with a signed
  `HttpOnly` state cookie, and link accounts by verified normalized email.
- Keep delivery behind a replaceable application interface. The interim
  `AuthDelivery` boundary was consolidated into the shared transactional email
  interface by ADR 0007 in Phase 9.

## Consequences

- The frontend keeps access tokens in memory and sends credentialed requests so
  the browser can manage refresh cookies.
- Deployments should keep frontend and API on the same site while
  `SameSite=Lax` is the supported cookie policy.
- OAuth callbacks set a refresh cookie and redirect to `/auth/callback`; the
  frontend then calls the refresh endpoint to obtain an access token.
- OAuth-only users have no local password unless a later account-settings flow
  explicitly adds one.
- Password-reset and verification delivery now uses the provider-neutral
  transactional email implementation defined by ADR 0007.
- Proxy trust and distributed rate-limit storage remain production-hardening
  responsibilities.

## References

- NestJS authentication: https://docs.nestjs.com/security/authentication
- NestJS rate limiting: https://docs.nestjs.com/security/rate-limiting
- OWASP password storage:
  https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
