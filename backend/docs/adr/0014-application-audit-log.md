# ADR 0014: Application Audit Log

## Status

Accepted on 2026-09-11.

## Context

ShipFlow needs a durable, backend-only record of security-sensitive and
business-critical actions. Ordinary request logs are useful operationally but
do not provide a stable domain event vocabulary, target attribution, retention
deadline, or database-enforced immutability.

## Decision

- Store audit records in PostgreSQL with an event type, outcome, severity,
  actor classification, optional actor/organization/target identifiers,
  request ID, source IP, user agent, reason code, bounded metadata, occurrence
  time, and expiry time.
- Keep actor and organization identifiers without foreign keys. This preserves
  the historical identifiers when a user or organization is deleted and avoids
  mutating an audit record through referential actions.
- Use a centralized `@Audit` decorator and interceptor for annotated domain
  operations. Record successful handler completion and handler or validation
  failures. Record access-token and organization-authorization guard failures
  directly because guards execute before interceptors.
- Cover registration and authentication, password and email-verification
  changes, 2FA lifecycle operations, organization and membership mutations,
  billing session/webhook actions, and file upload/download/lifecycle changes.
- Never record request or response bodies. Sanitize bounded metadata and redact
  credential, token, password, signature, secret, and recovery-code fields at
  the writer boundary. Treat invalid UUID and IP values as absent.
- Retain each record for 365 days. Run idempotent pruning at startup and every
  24 hours, deleting only rows whose `expires_at` deadline has elapsed.
- Enforce retention and append-only behavior in PostgreSQL: inserts are
  normalized to a 365-day deadline, updates always fail, and deletes fail
  before that deadline. Application code cannot weaken these rules. Database
  administrators retain the usual emergency authority.
- Keep audit storage backend/DB-only in v1. Do not expose customer-facing list,
  export, mutation, or deletion endpoints.
- Contain audit-writer failures so an already-completed user action is not
  reported as failed. Emit a generic operational error without including the
  rejected audit payload.

## Consequences

The audit trail is queryable by authorized operators at the database layer and
can later feed a restricted customer audit view or external SIEM without
changing event producers. Direct database access must remain tightly limited
and monitored by the production platform.

Audit writes add one database operation to each covered request. Event records
remain after related users and organizations are removed and are automatically
eligible for deletion after one year.
