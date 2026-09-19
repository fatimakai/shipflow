# ADR 0015: Public Demo Deployment Profile

- Status: Accepted
- Date: 2026-09-17

## Context

ShipFlow needs a continuously available portfolio deployment without paying for
the complete production integration stack. Silently omitting credentials or
controlling features only in React would leave partially configured server
paths reachable and would make the deployed security posture ambiguous.

## Decision

ShipFlow has an explicit `DEPLOYMENT_PROFILE=public-demo` mode. The API validates
that this profile uses log-only email, local storage, and disabled malware
scanning, while requiring configured Google and GitHub OAuth providers with
HTTPS callbacks. A global metadata-driven guard blocks public registration,
email verification and password recovery, all file routes, local file transfer,
and the Resend webhook.

OAuth is the public registration path and still requires ShipFlow's 2FA when an
account has it enabled. Existing local accounts may sign in. Invitations return
a single-display, email-bound acceptance URL to an authorized organization
manager; they are not delivered by email and their token is not returned by
later list operations.

The frontend mirrors these restrictions for usability, but backend enforcement
is authoritative. The public deployment uses a Render Free Docker service,
Neon Free PostgreSQL, Cloudflare Pages, and Stripe test mode. Database migrations
run idempotently before the application starts because Render Free services do
not provide a pre-deploy command.

## Consequences

- The public demo can expose real OAuth, 2FA, tenancy, invitations, audit logs,
  and test billing without claiming that unavailable integrations are live.
- Compromising or bypassing frontend routing does not restore disabled routes.
- File-storage and transactional-email code remains implemented and testable in
  the standard profile, but it is not part of public-demo acceptance.
- Invite links must be copied when created or rotated; losing one requires
  rotating it, which invalidates the previous link.
- Moving to the standard production profile requires the paid provider
  credentials and storage/scanning adapter described in the deployment runbook.
