# Upwork project copy

**Title:** ShipFlow — multi-tenant SaaS starter with OAuth, 2FA, RBAC, and Stripe

**Short description:** Built a full-stack SaaS reference application with organization-scoped permissions, secure sign-in, team invitations, and subscription billing. The public demo runs on Cloudflare Pages, Render, and Neon; Stripe checkout is in test mode.

**Project description:**

I designed ShipFlow as a decoupled NestJS API and React 19 application rather than a collection of disconnected screens. Users can sign in with Google or GitHub, create and switch organizations, invite teammates, and work under Owner/Admin/Member/Viewer permissions. Authenticator-based 2FA applies after OAuth or password sign-in, with single-use recovery codes and rotating refresh sessions.

For billing, Owners can start a Stripe test-mode subscription through Checkout and manage it in the Customer Portal. Signed, deduplicated webhooks synchronize organization entitlements to PostgreSQL. The frontend uses generated OpenAPI types, TanStack Query, Zustand, and validated forms; CI runs backend and frontend checks, tests, audits, and builds.

The live portfolio demo deliberately disables password registration/recovery and file operations. Resend integration, private R2 storage, and ClamAV scanning are implemented in the standard code path but are **not active in this public demo**. This distinction is important: the demo demonstrates the live identity, tenancy, team, and test-mode billing flows without claiming production email or file infrastructure.

**My role:** Full-stack architecture, implementation, deployment, testing, and documentation.

**Stack:** NestJS, React 19, TypeScript, PostgreSQL, Prisma, Stripe, Docker, Cloudflare Pages, Render, Neon.

**Links:** [Live demo](https://shipflow-duk.pages.dev) · [Source repository](https://github.com/fatimakai/shipflow) · [Technical case study](https://github.com/fatimakai/shipflow/blob/main/docs/case-study.md)

**Suggested gallery order:** Auth → 2FA → multi-organization → Pro dashboard → team → RBAC → Pro billing → security. The approved, privacy-safe product screenshots are stored under `docs/assets/screenshots`. Use CI, Stripe delivery, and deployment screenshots as supporting technical evidence, not the opening image.
