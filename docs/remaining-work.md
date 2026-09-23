# ShipFlow Remaining Work

Audited against the repository on 2026-09-23.

## Status Boundary

The public portfolio demo and Phase 9 case-study package are complete: the demo
is deployed, the selected workflows have been exercised, CI is green, and the
README, technical case study, Upwork copy, and curated evidence are present.

The commercial ShipFlow v1 release is not yet complete. The checklist below is
the remaining work required before the repository should be described as a
production-ready, supportable product for third-party deployment.

## P0 — Commercial V1 Release Blockers

- [ ] Remove the invitation token from browser history before sending the
      acceptance request, and cover success and failure behavior with tests.
- [ ] Add standard-profile browser tests for expired, reused, revoked, and
      malformed verification, reset, and invitation links.
- [ ] Choose the paid-production application and database topology. Record why
      it is appropriate for expected availability, scaling, recovery, and cost.
- [ ] Provision and smoke-test the implemented-but-disabled providers in a
      standard-profile environment: Resend with verified DNS/webhooks, private
      R2 object storage, and ClamAV scanning.
- [ ] Choose centralized backend log retention and frontend/backend error
      monitoring, including release identifiers and redaction rules.
- [ ] Configure off-site backups and complete a documented restore, rollback,
      and incident-response drill against the paid-production topology.
- [ ] Decide whether commercial v1 needs multiple API instances. If it does,
      add shared/distributed throttling before horizontal scaling.
- [ ] Add a root or route-level frontend error boundary, monitoring boundary,
      and user-safe recovery experience.
- [ ] Document source-map publication and retention. Revalidate the deployed CSP
      when production email, storage, monitoring, or analytics services change
      the allowed origins.
- [ ] Establish performance budgets and verify route loading, JavaScript bundle
      size, and critical interactions against them.
- [ ] Complete keyboard and automated accessibility audits at supported
      viewports, including 360 CSS pixels.
- [ ] Run release-critical journeys in Chrome, Edge, Firefox, and Safari/WebKit;
      current automated browser CI covers Chromium only.
- [ ] Publish versioned OpenAPI artifacts and define who regenerates, reviews,
      and commits the matching frontend client types.
- [ ] Add visual-regression and preview-deployment checks appropriate to the
      release workflow.
- [ ] Add dependency-update automation with the existing CI suite as a required
      gate.
- [ ] Define semantic versioning, tags, changelogs, frontend/backend
      compatibility, release ownership, approval gates, support policy, and
      branch protection. No release tags currently exist.

## P1 — Beta And Launch

- [ ] Freeze the v1 API, database migrations, generated frontend contract, and
      compatibility baseline.
- [ ] Provide realistic, non-sensitive, resettable demo data for evaluator and
      beta-user sessions.
- [ ] Run the complete standard-profile account, organization, billing,
      notification, email, and file journeys with beta users.
- [ ] Resolve release-blocking security, accessibility, browser, responsive,
      performance, and workflow defects found during beta.
- [ ] Publish versioned release notes, migration guidance, support terms, and
      source/update delivery procedures.
- [ ] Complete one clean-checkout release rehearsal and one rollback rehearsal,
      preserving the evidence needed for release approval.

## Explicit Product Decisions

- [ ] Decide whether analytics is required for v1. If enabled, document privacy,
      consent, retention, and opt-out behavior; otherwise record the deferral.
- [ ] Decide whether preview deployments may access shared services and define
      their data-isolation and secret-handling rules.
- [ ] Confirm the commercial packaging and licensing terms; the backend is
      currently marked `UNLICENSED` rather than published under a reusable
      package license.

## Already Verified — Do Not Reopen Without New Evidence

- [x] Organization-scoped tenancy, RBAC, invitations, and tenant-safe query
      behavior are implemented and tested.
- [x] Google OAuth, password authentication, rotating refresh tokens, TOTP 2FA,
      and single-use recovery codes are implemented; the public demo has been
      exercised with Google OAuth and 2FA.
- [x] Stripe test-mode Checkout, Portal, signed webhook delivery, subscription
      state, and organization-scoped billing presentation are working.
- [x] The public demo blocks password registration/recovery, file APIs, and the
      Resend webhook while retaining those capabilities in the standard profile.
- [x] Render, Neon, Cloudflare Pages, the same-origin API proxy, liveness and
      readiness endpoints, UptimeRobot checks, and deployment evidence are in
      place for the portfolio demo.
- [x] GitHub Actions is green and verifies backend and frontend formatting,
      linting, tests, builds, production dependency audits, database migrations,
      and the backend production container.
- [x] The root README, technical case study, public-demo deployment guide,
      Upwork copy, and curated product/operational screenshots are present.

## Definition Of Commercial Completion

Commercial v1 is complete only when every P0 item is closed, release-critical
P1 validation has passed, a versioned release is tagged, and the final provider
topology can be deployed and rolled back from clean checkouts using the
published documentation.
