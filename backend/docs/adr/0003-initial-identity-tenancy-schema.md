# ADR 0003: Initial Identity and Tenancy Schema

- Status: Accepted
- Date: 2026-08-07

## Context

NestShip needs durable identity, session, and organization boundaries before
authentication and organization APIs are implemented. The first schema must
support email and OAuth identities, refresh-token rotation, organization
membership, and single-use invitations without prematurely defining billing.

## Decision

- Use PostgreSQL-native UUID v7 defaults for persistent entity identifiers.
- Map singular PascalCase Prisma models and camelCase fields to plural
  snake_case tables and snake_case columns.
- Store application timestamps as UTC-aware `timestamptz(3)` values.
- Store canonical lowercase, trimmed email addresses and enforce normalization
  with database check constraints.
- Allow users to exist without an organization during onboarding.
- Soft-delete users and organizations while cascading physical deletion to
  sessions, tokens, OAuth accounts, memberships, and invitations.
- Represent one explicit organization owner and enforce one `OWNER` membership
  per organization. Application services must create the organization and its
  owner membership in one transaction and keep them consistent during transfer.
- Support `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER` memberships. Invitations may
  grant every role except `OWNER`.
- Make invitations single-use, revocable, seven days by application policy,
  and unique by normalized email while pending in an organization.
- Store only refresh-token hashes. Track rotation families, replacement links,
  revocation time, and revocation reason so reuse can revoke a token family.
- Keep billing models out of this migration until the Stripe product,
  subscription, trial, and cancellation lifecycle is approved.

## Consequences

- PostgreSQL 18 or newer is required because identifiers use the built-in
  `uuidv7()` function.
- Email normalization happens before persistence and is also protected by the
  database; mixed-case or padded values are rejected.
- Partial unique indexes and check constraints are maintained as custom SQL in
  Prisma migrations because they are not all expressible in Prisma schema.
- Organization creation and ownership transfer require transactional service
  methods to preserve the owner field and membership invariant.
- Expired invitations must be moved from `PENDING` to `EXPIRED` before another
  invitation can be issued to the same organization and email.
- Development seed data contains no passwords, OAuth credentials, or token
  secrets.

## References

- PostgreSQL UUID functions: https://www.postgresql.org/docs/18/functions-uuid.html
- Prisma PostgreSQL connector:
  https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql
