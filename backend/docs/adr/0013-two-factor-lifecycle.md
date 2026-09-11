# ADR 0013: Two-Factor Lifecycle and Login Challenges

## Status

Accepted on 2026-09-11.

## Decision

- Start setup only from an authenticated bearer session. Replacing an
  unfinished setup invalidates its prior secret; an enabled credential cannot
  be overwritten by the setup endpoint.
- Require a valid TOTP before enabling the credential. Generate ten recovery
  codes transactionally with activation and return their plaintext exactly
  once. Revoke every pre-2FA refresh session so none can continue bypassing the
  newly enabled second factor.
- Treat password and OAuth authentication as first factors. If 2FA is enabled,
  create a random opaque login challenge instead of an access token, refresh
  token, or session.
- Store only the SHA-256 challenge-token hash. Challenges are login-only,
  expire after five minutes, and are consumed atomically with the TOTP time
  step or recovery code and new refresh session.
- Permit the current TOTP time step only once. Consume recovery codes with a
  conditional database update so concurrent requests cannot reuse them.
- Require the current password plus a TOTP or recovery code before recovery
  code regeneration or user-initiated disabling. OAuth-only accounts have no
  local password, so their authenticated bearer session plus current second
  factor is the available step-up proof.
- Revoke all refresh sessions when 2FA is disabled. Existing stateless access
  tokens retain their normal maximum lifetime of 15 minutes, consistent with
  logout and password-reset behavior.
- Transport OAuth challenges to the frontend in a URL fragment so the token is
  not sent in HTTP referrers or server request targets.

## Consequences

No application session exists between first- and second-factor verification.
Possession of a challenge alone grants no account access, and replaying a
consumed challenge, TOTP time step, or recovery code fails.

The frontend must recognize the challenge response from password login and the
OAuth `/auth/two-factor#challenge=...` redirect. Screens and client-side flow
integration are intentionally handled in the next frontend phase.

Audit events and the documented support-admin recovery operation depend on the
dedicated audit and administration phases and are not introduced here.
