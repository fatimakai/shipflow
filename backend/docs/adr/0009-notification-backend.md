# ADR 0009: Persistent Notification Backend

- Status: Accepted
- Date: 2026-08-08

## Context

Shipflow needs persistent in-app notifications for account security,
organization activity, and billing lifecycle changes. Notifications must remain
user-owned and tenant-safe, avoid duplicate records during retries, respect
optional preferences at creation time, and support efficient polling without
introducing Redis, queues, or real-time infrastructure.

## Decision

- Implement in-app notifications only. Transactional email remains a separate
  delivery channel; push, SMS, WebSockets, server-sent events, Redis, and queues
  are outside Phase 12.
- Use Security, Organization, and Billing categories with source-controlled
  notification types, titles, messages, safe metadata, and optional relative
  action paths. Do not store tokens, provider payloads, secrets, or HTML.
- Make every notification belong to one user. An optional organization
  reference supports filtering but never grants visibility to another member.
  Historical notifications remain user-owned if the organization is deleted.
- Keep password-change and billing notifications mandatory. Allow each user to
  disable the Organization category globally; it is enabled by default.
- Do not notify an actor about their own routine organization action. Notify the
  affected member, and notify the Owner when an Admin changes or removes a
  member. Billing events always notify the current organization Owner.
- Create notifications in the same PostgreSQL transaction as the state change
  they describe. Use a unique `(user_id, dedupe_key)` and an empty-update upsert
  so retries and webhook replay do not duplicate records.
- Retain notifications for 90 days. Exclude expired records from reads and run
  an idempotent hard-delete pass at application startup and every six hours.
- List notifications newest-first using an opaque cursor containing
  `(created_at, id)`. Default to 20 records and cap requests at 100.
- Support optional unread-only and organization filters, an unread count,
  idempotent mark-read, and mark-all-read with a request-time cutoff so a
  concurrent future notification is not changed.
- Expose polling-compatible REST APIs. The frontend should poll unread count
  every 30 seconds while visible, refresh on focus, and pause while hidden.

## Consequences

- Notification access does not depend on current organization membership and
  cannot expose another user's records.
- Optional preferences are enforced when notifications are created; changing a
  preference does not delete historical records.
- Mandatory security and billing events cannot be disabled through the API.
- Multiple application instances may run the same retention delete safely.
- Real-time delivery or additional channels require a later infrastructure and
  preference-model decision.
