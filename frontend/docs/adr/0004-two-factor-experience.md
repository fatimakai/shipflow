# ADR 0004: Two-Factor Authentication Experience

- Status: Accepted
- Date: 2026-09-11

## Context

The backend treats password and OAuth authentication as first factors and
returns a single-purpose, five-minute challenge when an account has two-factor
authentication enabled. The frontend must complete that challenge without
creating a partial application session or leaking OAuth challenge tokens.

## Decisions

1. Route password challenge responses and OAuth fragment challenges to one
   public verification page. Do not place the challenge in query parameters,
   browser storage, logs, or the authentication store.
2. Remove an OAuth challenge from the visible URL immediately and retain it in
   route state only for the current navigation entry.
3. Apply authentication and enter the protected application only after the
   challenge endpoint returns a complete authentication response.
4. Generate authenticator QR codes locally with `qrcode`; never send the
   provisioning URI or TOTP secret to an external QR service.
5. Display recovery codes only from setup-confirmation and regeneration
   responses. Offer copy and plain-text download actions, then remove the codes
   from component state when the user acknowledges them.
6. Require password plus authenticator or recovery code in the step-up dialog.
   Permit a blank password for OAuth-only accounts, matching backend policy.
7. Clear the frontend session after activation or disabling because the backend
   revokes refresh sessions for both security-boundary changes.

## Consequences

There is no authenticated client state between the first and second factors.
Reloading a password-originated verification page requires a new sign-in;
OAuth-originated fragments survive only long enough to be moved into route
state. Setup, regeneration, disabling, single-display recovery codes, and both
challenge origins are covered by component and browser workflow tests.
